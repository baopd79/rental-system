from sqlmodel.ext.asyncio.session import AsyncSession
from app.models.shared_meter import SharedMeter, SharedMeterReading
from app.schemas.shared_meter import (
    SharedMeterCreate, SharedMeterUpdate, SharedMeterRead,
    SharedMeterReadingCreate, SharedMeterReadingRead,
)
from app.repositories.shared_meter_repo import SharedMeterRepo
from app.repositories.property_repo import PropertyRepo
from app.repositories.room_repo import RoomRepo
from app.repositories.contract_repo import ContractRepo
from app.repositories.invoice_repo import InvoiceRepo
from app.core.exceptions import NotFoundException, ForbiddenException, BadRequestException


def _prev_period(period: str) -> str:
    y, m = int(period[:4]), int(period[5:7])
    return f"{y - 1}-12" if m == 1 else f"{y}-{str(m - 1).zfill(2)}"


def _next_period(period: str) -> str:
    y, m = int(period[:4]), int(period[5:7])
    return f"{y + 1}-01" if m == 12 else f"{y}-{str(m + 1).zfill(2)}"


class SharedMeterService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.repo = SharedMeterRepo(session)
        self.property_repo = PropertyRepo(session)
        self.room_repo = RoomRepo(session)
        self.contract_repo = ContractRepo(session)
        self.invoice_repo = InvoiceRepo(session)

    async def _get_property_owned(self, property_id: int, clerk_user_id: str):
        prop = await self.property_repo.get_by_id(property_id)
        if not prop or prop.clerk_user_id != clerk_user_id:
            raise NotFoundException("Property not found")
        return prop

    async def _get_meter_owned(self, meter_id: int, clerk_user_id: str) -> SharedMeter:
        meter = await self.repo.get_by_id(meter_id)
        if not meter:
            raise NotFoundException("Shared meter not found")
        prop = await self.property_repo.get_by_id(meter.property_id)
        if not prop or prop.clerk_user_id != clerk_user_id:
            raise ForbiddenException()
        return meter

    async def _to_read(self, meter: SharedMeter) -> SharedMeterRead:
        room_ids = await self.repo.get_room_ids(meter.id)
        return SharedMeterRead(
            id=meter.id,
            property_id=meter.property_id,
            name=meter.name,
            room_ids=room_ids,
        )

    # ── Meters ────────────────────────────────────────────────────

    async def list_meters(self, property_id: int, clerk_user_id: str) -> list[SharedMeterRead]:
        await self._get_property_owned(property_id, clerk_user_id)
        meters = await self.repo.get_by_property(property_id)
        return [await self._to_read(m) for m in meters]

    async def create_meter(self, property_id: int, data: SharedMeterCreate, clerk_user_id: str) -> SharedMeterRead:
        await self._get_property_owned(property_id, clerk_user_id)
        meter = SharedMeter(property_id=property_id, name=data.name)
        created = await self.repo.create(meter)
        await self.session.commit()
        await self.session.refresh(created)
        return await self._to_read(created)

    async def update_meter(self, meter_id: int, data: SharedMeterUpdate, clerk_user_id: str) -> SharedMeterRead:
        meter = await self._get_meter_owned(meter_id, clerk_user_id)
        meter.name = data.name
        await self.repo.update(meter)
        await self.session.commit()
        await self.session.refresh(meter)
        return await self._to_read(meter)

    async def delete_meter(self, meter_id: int, clerk_user_id: str) -> None:
        meter = await self._get_meter_owned(meter_id, clerk_user_id)
        await self.repo.delete(meter)
        await self.session.commit()

    # ── Room assignments ──────────────────────────────────────────

    async def add_room(self, meter_id: int, room_id: int, clerk_user_id: str) -> SharedMeterRead:
        meter = await self._get_meter_owned(meter_id, clerk_user_id)
        room = await self.room_repo.get_by_id(room_id)
        if not room or room.property_id != meter.property_id:
            raise BadRequestException("Room does not belong to this property")
        await self.repo.add_room(meter_id, room_id)
        await self.session.commit()
        return await self._to_read(meter)

    async def remove_room(self, meter_id: int, room_id: int, clerk_user_id: str) -> SharedMeterRead:
        meter = await self._get_meter_owned(meter_id, clerk_user_id)
        await self.repo.remove_room(meter_id, room_id)
        await self.session.commit()
        return await self._to_read(meter)

    # ── Readings ──────────────────────────────────────────────────

    async def upsert_reading(self, data: SharedMeterReadingCreate, clerk_user_id: str) -> SharedMeterReadingRead:
        meter = await self._get_meter_owned(data.shared_meter_id, clerk_user_id)

        # Determine prev_reading: manual override takes priority, else auto-fill from previous period
        if data.prev_reading is not None:
            prev_val = data.prev_reading
            is_prev_auto = False
        else:
            prev_p = _prev_period(data.period)
            prev_reading_row = await self.repo.get_reading(meter.id, prev_p)
            prev_val = prev_reading_row.curr_reading if prev_reading_row else None
            is_prev_auto = prev_reading_row is not None

        if prev_val is not None and data.curr_reading < prev_val:
            raise BadRequestException("curr_reading phải >= prev_reading")

        existing = await self.repo.get_reading(meter.id, data.period)
        if existing:
            # Block if N+1 already has a reading
            next_reading = await self.repo.get_reading(meter.id, _next_period(data.period))
            if next_reading is not None:
                raise BadRequestException(
                    f"Không thể sửa chỉ số kỳ {data.period} vì kỳ {_next_period(data.period)} đã có chỉ số lưu."
                )
            # Block if any room using this meter already has an invoice for this period
            room_ids = await self.repo.get_room_ids(meter.id)
            for rid in room_ids:
                contract = await self.contract_repo.get_active_by_room(rid)
                if contract is None:
                    # check ended contracts that were active during this period
                    all_contracts = await self.contract_repo.get_all_by_room(rid)
                    contract = next(
                        (c for c in all_contracts
                         if c.start_date.strftime("%Y-%m") <= data.period <= c.end_date.strftime("%Y-%m")),
                        None,
                    )
                if contract:
                    invoice = await self.invoice_repo.get_by_contract_period(contract.id, data.period)
                    if invoice is not None:
                        raise BadRequestException(
                            f"Không thể sửa chỉ số kỳ {data.period} vì hoá đơn kỳ này đã được tạo."
                        )
            existing.curr_reading = data.curr_reading
            existing.prev_reading = prev_val
            existing.is_prev_auto = is_prev_auto
            updated = await self.repo.update_reading(existing)
            await self.session.commit()
            await self.session.refresh(updated)
            return SharedMeterReadingRead.model_validate(updated)

        reading = SharedMeterReading(
            shared_meter_id=meter.id,
            period=data.period,
            prev_reading=prev_val,
            curr_reading=data.curr_reading,
            is_prev_auto=is_prev_auto,
        )
        created = await self.repo.create_reading(reading)
        await self.session.commit()
        await self.session.refresh(created)
        return SharedMeterReadingRead.model_validate(created)

    async def list_readings(self, meter_id: int, clerk_user_id: str) -> list[SharedMeterReadingRead]:
        await self._get_meter_owned(meter_id, clerk_user_id)
        readings = await self.repo.get_readings_by_meter(meter_id)
        return [SharedMeterReadingRead.model_validate(r) for r in readings]
