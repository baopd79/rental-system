from decimal import Decimal
from fastapi import Depends
from sqlmodel.ext.asyncio.session import AsyncSession
from app.database import get_session
from app.models.utility import UtilityReading
from app.models.property import WaterCalcType
from app.models.invoice import InvoiceStatus
from app.schemas.billing import (
    RoomBillingStatus, BatchReadingRequest, BatchReadingItem,
    BatchInvoiceRequest, BatchInvoiceResult,
)
from app.schemas.invoice import InvoiceGenerateRequest
from app.repositories.billing_repo import BillingRepo
from app.repositories.property_repo import PropertyRepo
from app.repositories.utility_repo import UtilityRepo
from app.services.invoice_service import InvoiceService
from app.services.utility_service import _prev_period
from app.core.exceptions import ForbiddenException, NotFoundException, BadRequestException, ConflictException


class BillingService:
    def __init__(self, session: AsyncSession = Depends(get_session)):
        self.session = session
        self.billing_repo = BillingRepo(session)
        self.property_repo = PropertyRepo(session)
        self.utility_repo = UtilityRepo(session)
        self.invoice_service = InvoiceService(session)

    async def _get_property_owned(self, property_id: int, clerk_user_id: str):
        prop = await self.property_repo.get_by_id(property_id)
        if not prop:
            raise NotFoundException("Property not found")
        if prop.clerk_user_id != clerk_user_id:
            raise ForbiddenException()
        return prop

    async def get_status(self, property_id: int, period: str, clerk_user_id: str) -> list[RoomBillingStatus]:
        await self._get_property_owned(property_id, clerk_user_id)
        rows = await self.billing_repo.get_room_billing_status(property_id, period, _prev_period(period))
        return [RoomBillingStatus(**row) for row in rows]

    async def batch_save_readings(
        self, property_id: int, data: BatchReadingRequest, clerk_user_id: str
    ) -> list[RoomBillingStatus]:
        prop = await self._get_property_owned(property_id, clerk_user_id)

        for item in data.readings:
            existing = await self.utility_repo.get_by_room_period(item.room_id, data.period)

            if existing:
                # Update in place — batch context bypasses "latest only" restriction
                if item.elec_curr < (existing.elec_prev or Decimal("0")):
                    raise BadRequestException(
                        f"Phòng {item.room_id}: chỉ số điện cuối kỳ nhỏ hơn đầu kỳ"
                    )
                existing.elec_curr = item.elec_curr
                if prop.water_calc_type == WaterCalcType.per_meter and item.water_curr is not None:
                    if existing.water_prev is not None and item.water_curr < existing.water_prev:
                        raise BadRequestException(
                            f"Phòng {item.room_id}: chỉ số nước cuối kỳ nhỏ hơn đầu kỳ"
                        )
                    existing.water_curr = item.water_curr
                await self.utility_repo.update(existing)
            else:
                # Create new — auto-fill prev from previous month
                prev = await self.utility_repo.get_by_room_period(item.room_id, _prev_period(data.period))
                elec_prev = prev.elec_curr if prev else None
                is_prev_auto = prev is not None

                if elec_prev is not None and item.elec_curr < elec_prev:
                    raise BadRequestException(
                        f"Phòng {item.room_id}: chỉ số điện cuối kỳ nhỏ hơn đầu kỳ"
                    )

                if prop.water_calc_type == WaterCalcType.per_meter:
                    water_prev = prev.water_curr if prev else None
                    water_curr = item.water_curr
                    if water_prev is not None and water_curr is not None and water_curr < water_prev:
                        raise BadRequestException(
                            f"Phòng {item.room_id}: chỉ số nước cuối kỳ nhỏ hơn đầu kỳ"
                        )
                else:
                    water_prev = None
                    water_curr = None

                reading = UtilityReading(
                    room_id=item.room_id,
                    period=data.period,
                    elec_prev=elec_prev,
                    elec_curr=item.elec_curr,
                    water_prev=water_prev,
                    water_curr=water_curr,
                    is_prev_auto=is_prev_auto,
                )
                await self.utility_repo.create(reading)

        await self.session.commit()
        rows = await self.billing_repo.get_room_billing_status(property_id, data.period, _prev_period(data.period))
        return [RoomBillingStatus(**row) for row in rows]

    async def batch_generate_invoices(
        self, property_id: int, data: BatchInvoiceRequest, clerk_user_id: str
    ) -> BatchInvoiceResult:
        await self._get_property_owned(property_id, clerk_user_id)
        rows = await self.billing_repo.get_room_billing_status(property_id, data.period)

        created = 0
        skipped = 0
        errors: list[str] = []

        for row in rows:
            # Skip: already has invoice
            if row["invoice_id"] is not None:
                skipped += 1
                continue

            # Skip: no reading
            if row["reading_id"] is None:
                continue

            try:
                await self.invoice_service.generate(
                    InvoiceGenerateRequest(contract_id=row["contract_id"], period=data.period),
                    clerk_user_id,
                )
                created += 1
            except ConflictException:
                skipped += 1
            except Exception as e:
                errors.append(f"Phòng {row['room_number']}: {e}")

        return BatchInvoiceResult(created=created, skipped=skipped, errors=errors)
