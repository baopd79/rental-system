import calendar
from decimal import Decimal
from datetime import date
from sqlmodel.ext.asyncio.session import AsyncSession
from app.models.utility import UtilityReading
from app.models.property import WaterCalcType
from app.schemas.billing import (
    RoomBillingStatus, BatchReadingRequest,
    BatchInvoiceRequest, BatchInvoiceResult,
    InvoicePreviewRow, InvoicePreviewSurcharge,
)
from app.schemas.invoice import InvoiceGenerateRequest
from app.repositories.billing_repo import BillingRepo
from app.repositories.property_repo import PropertyRepo
from app.repositories.surcharge_repo import SurchargeRepo
from app.repositories.utility_repo import UtilityRepo
from app.repositories.shared_meter_repo import SharedMeterRepo
from app.repositories.contract_repo import ContractRepo
from app.services.invoice_service import InvoiceService, _build_items, _build_shared_elec_items, _prorate_factor, _round
from app.services.utility_service import _prev_period, _next_period
from app.core.exceptions import ForbiddenException, NotFoundException, BadRequestException, ConflictException


class BillingService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.billing_repo = BillingRepo(session)
        self.property_repo = PropertyRepo(session)
        self.surcharge_repo = SurchargeRepo(session)
        self.utility_repo = UtilityRepo(session)
        self.shared_meter_repo = SharedMeterRepo(session)
        self.contract_repo = ContractRepo(session)
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
        rows = await self.billing_repo.get_room_billing_status(
            property_id, period, _prev_period(period), _next_period(period)
        )
        return [RoomBillingStatus(**row) for row in rows]

    async def get_invoice_preview(
        self, property_id: int, period: str, clerk_user_id: str
    ) -> list[InvoicePreviewRow]:
        prop = await self._get_property_owned(property_id, clerk_user_id)
        rows = await self.billing_repo.get_invoice_preview_data(property_id, period)
        surcharges = await self.surcharge_repo.get_all_by_property(property_id)

        year, month = int(period[:4]), int(period[5:7])
        days_in_month = calendar.monthrange(year, month)[1]

        result = []
        for row in rows:
            contract_start: date = row["contract_start"]
            contract_end: date = row["contract_end"]

            # Build mock contract and reading objects for _build_items
            from app.models.contract import Contract, ContractStatus
            contract = Contract(
                id=row["contract_id"],
                room_id=row["room_id"],
                tenant_id=row["tenant_id"],
                start_date=contract_start,
                end_date=contract_end,
                agreed_rent=row["agreed_rent"],
                deposit=Decimal("0"),
                num_people=row["num_people"],
                status=ContractStatus.active,
            )

            has_reading = row["reading_id"] is not None
            has_invoice = row["invoice_id"] is not None

            if has_invoice:
                # Use stored invoice amounts — do not re-calculate from current rates.
                # Rates or surcharges may have changed since the invoice was created.
                D = Decimal
                rent_amount        = D(str(row["inv_rent"]        or 0))
                elec_amount        = D(str(row["inv_elec"]        or 0))
                water_amount       = D(str(row["inv_water"]       or 0))
                shared_elec_amount = D(str(row["inv_shared_elec"] or 0))
                surcharge_total    = D(str(row["inv_surcharge"]   or 0))
                surcharge_items: list[InvoicePreviewSurcharge] = []
                total              = D(str(row["invoice_total"]   or 0))
                is_prorated        = False
                prorate_label      = None
            else:
                if has_reading:
                    reading = UtilityReading(
                        id=row["reading_id"],
                        room_id=row["room_id"],
                        period=period,
                        elec_prev=row["elec_prev"],
                        elec_curr=row["elec_curr"],
                        water_prev=row["water_prev"],
                        water_curr=row["water_curr"],
                        is_prev_auto=False,
                    )
                else:
                    reading = None

                items = _build_items(contract, reading, surcharges, prop, prop.default_elec_rate, period)
                shared_items = await _build_shared_elec_items(
                    row["room_id"], row["num_people"], prop, period,
                    self.shared_meter_repo, self.contract_repo,
                )
                items.extend(shared_items)

                from app.models.invoice import InvoiceItemType
                rent_amount        = sum(i.amount for i in items if i.item_type == InvoiceItemType.rent)
                elec_amount        = sum(i.amount for i in items if i.item_type == InvoiceItemType.electricity)
                water_amount       = sum(i.amount for i in items if i.item_type == InvoiceItemType.water)
                shared_elec_amount = sum(i.amount for i in items if i.item_type == InvoiceItemType.shared_elec)
                surcharge_items    = [
                    InvoicePreviewSurcharge(name=i.name, amount=i.amount)
                    for i in items if i.item_type == InvoiceItemType.surcharge
                ]
                surcharge_total = sum(s.amount for s in surcharge_items)
                total           = _round(sum(i.amount for i in items))

                factor = _prorate_factor(contract_start, contract_end, period)
                is_prorated = factor < Decimal("1")
                if is_prorated:
                    eff_start = max(contract_start, date(year, month, 1))
                    eff_end = min(contract_end, date(year, month, days_in_month))
                    days = (eff_end - eff_start).days + 1
                    prorate_label = f"{days}/{days_in_month} ngày"
                else:
                    prorate_label = None

            result.append(InvoicePreviewRow(
                room_id=row["room_id"],
                room_number=row["room_number"],
                contract_id=row["contract_id"],
                tenant_name=row["tenant_name"],
                contract_start=contract_start,
                contract_end=contract_end,
                is_prorated=is_prorated,
                prorate_label=prorate_label,
                has_reading=has_reading,
                elec_prev=row["elec_prev"],
                elec_curr=row["elec_curr"],
                water_prev=row["water_prev"],
                water_curr=row["water_curr"],
                rent_amount=rent_amount,
                elec_amount=elec_amount,
                water_amount=water_amount,
                shared_elec_amount=shared_elec_amount,
                surcharges=surcharge_items,
                surcharge_total=surcharge_total,
                total=total,
                invoice_id=row["invoice_id"],
                invoice_status=row["invoice_status"],
                invoice_public_token=row["invoice_public_token"],
            ))

        return result

    async def batch_save_readings(
        self, property_id: int, data: BatchReadingRequest, clerk_user_id: str
    ) -> list[RoomBillingStatus]:
        prop = await self._get_property_owned(property_id, clerk_user_id)

        next_period = _next_period(data.period)
        for item in data.readings:
            # Block editing period N if period N+1 already has a reading.
            # N+1.elec_prev was auto-filled from N.elec_curr; changing N would silently
            # corrupt N+1's prev and any invoice already generated from it.
            next_reading = await self.utility_repo.get_by_room_period(item.room_id, next_period)
            existing = await self.utility_repo.get_by_room_period(item.room_id, data.period)
            if existing and next_reading is not None:
                raise BadRequestException(
                    f"Phòng {item.room_id}: không thể sửa chỉ số kỳ {data.period} "
                    f"vì kỳ {next_period} đã có chỉ số lưu."
                )

            if existing:
                if existing.elec_prev is None:
                    # Move-in baseline: shift prev←baseline, curr←new (equal = 0 consumption, allowed)
                    if item.elec_curr < existing.elec_curr:
                        raise BadRequestException(
                            f"Phòng {item.room_id}: chỉ số điện mới nhỏ hơn chỉ số vào"
                        )
                    existing.elec_prev = existing.elec_curr
                    existing.elec_curr = item.elec_curr
                else:
                    if item.elec_curr < existing.elec_prev:
                        raise BadRequestException(
                            f"Phòng {item.room_id}: chỉ số điện cuối kỳ nhỏ hơn đầu kỳ"
                        )
                    existing.elec_curr = item.elec_curr
                if prop.water_calc_type == WaterCalcType.per_meter and item.water_curr is not None:
                    if existing.water_prev is None and existing.water_curr is not None:
                        existing.water_prev = existing.water_curr
                    if existing.water_prev is not None and item.water_curr < existing.water_prev:
                        raise BadRequestException(
                            f"Phòng {item.room_id}: chỉ số nước cuối kỳ nhỏ hơn đầu kỳ"
                        )
                    existing.water_curr = item.water_curr
                await self.utility_repo.update(existing)
            else:
                active_contract = await self.contract_repo.get_active_by_room(item.room_id)
                contract_id = active_contract.id if active_contract else None

                prev_reading = await self.utility_repo.get_by_room_period(item.room_id, _prev_period(data.period))

                # Only carry over prev reading if it belongs to the same contract.
                # A prev reading from an old tenant must never contaminate the new tenant's billing.
                same_contract_prev = (
                    prev_reading
                    if prev_reading is not None and prev_reading.contract_id == contract_id
                    else None
                )
                elec_prev = same_contract_prev.elec_curr if same_contract_prev else None
                is_prev_auto = same_contract_prev is not None

                # Month-skip guard: only enforce continuity within the same contract.
                # Gaps from a previous tenant's readings must not block the new tenant.
                if same_contract_prev is None:
                    latest = await self.utility_repo.get_latest_by_room(item.room_id)
                    if latest is not None and latest.contract_id == contract_id:
                        raise BadRequestException(
                            f"Phòng {item.room_id}: chưa có chỉ số kỳ {_prev_period(data.period)}, "
                            f"không thể nhảy sang kỳ {data.period}. Vui lòng nhập theo thứ tự tháng."
                        )

                if elec_prev is not None and item.elec_curr < elec_prev:
                    raise BadRequestException(
                        f"Phòng {item.room_id}: chỉ số điện cuối kỳ nhỏ hơn đầu kỳ"
                    )

                if prop.water_calc_type == WaterCalcType.per_meter:
                    water_prev = same_contract_prev.water_curr if same_contract_prev else None
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
                    contract_id=contract_id,
                    period=data.period,
                    elec_prev=elec_prev,
                    elec_curr=item.elec_curr,
                    water_prev=water_prev,
                    water_curr=water_curr,
                    is_prev_auto=is_prev_auto,
                )
                await self.utility_repo.create(reading)

        await self.session.commit()
        rows = await self.billing_repo.get_room_billing_status(
            property_id, data.period, _prev_period(data.period), next_period
        )
        return [RoomBillingStatus(**row) for row in rows]

    async def batch_generate_invoices(
        self, property_id: int, data: BatchInvoiceRequest, clerk_user_id: str
    ) -> BatchInvoiceResult:
        await self._get_property_owned(property_id, clerk_user_id)
        created = 0
        skipped = 0
        errors: list[str] = []

        for contract_id in data.contract_ids:
            try:
                await self.invoice_service.generate(
                    InvoiceGenerateRequest(contract_id=contract_id, period=data.period),
                    clerk_user_id,
                )
                created += 1
            except ConflictException:
                skipped += 1
            except Exception as e:
                errors.append(str(e))

        return BatchInvoiceResult(created=created, skipped=skipped, errors=errors)
