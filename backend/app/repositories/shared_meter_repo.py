from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from app.models.shared_meter import SharedMeter, SharedMeterRoom, SharedMeterReading


def _prev_period(period: str) -> str:
    y, m = int(period[:4]), int(period[5:7])
    return f"{y - 1}-12" if m == 1 else f"{y}-{str(m - 1).zfill(2)}"


class SharedMeterRepo:
    def __init__(self, session: AsyncSession):
        self.session = session

    # ── Meters ────────────────────────────────────────────────────

    async def get_by_id(self, meter_id: int) -> SharedMeter | None:
        return await self.session.get(SharedMeter, meter_id)

    async def get_by_property(self, property_id: int) -> list[SharedMeter]:
        result = await self.session.exec(
            select(SharedMeter).where(SharedMeter.property_id == property_id)
        )
        return list(result.all())

    async def create(self, meter: SharedMeter) -> SharedMeter:
        self.session.add(meter)
        await self.session.flush()
        return meter

    async def update(self, meter: SharedMeter) -> SharedMeter:
        self.session.add(meter)
        await self.session.flush()
        return meter

    async def delete(self, meter: SharedMeter) -> None:
        # Remove all room associations and readings first
        junctions = await self.session.exec(
            select(SharedMeterRoom).where(SharedMeterRoom.shared_meter_id == meter.id)
        )
        for j in junctions.all():
            await self.session.delete(j)
        readings = await self.session.exec(
            select(SharedMeterReading).where(SharedMeterReading.shared_meter_id == meter.id)
        )
        for r in readings.all():
            await self.session.delete(r)
        await self.session.flush()
        await self.session.delete(meter)
        await self.session.flush()

    # ── Room assignments ──────────────────────────────────────────

    async def get_room_ids(self, meter_id: int) -> list[int]:
        result = await self.session.exec(
            select(SharedMeterRoom).where(SharedMeterRoom.shared_meter_id == meter_id)
        )
        return [r.room_id for r in result.all()]

    async def get_meters_for_room(self, room_id: int) -> list[SharedMeter]:
        result = await self.session.exec(
            select(SharedMeter)
            .join(SharedMeterRoom, SharedMeter.id == SharedMeterRoom.shared_meter_id)  # type: ignore[arg-type]
            .where(SharedMeterRoom.room_id == room_id)
        )
        return list(result.all())

    async def add_room(self, meter_id: int, room_id: int) -> None:
        existing = await self.session.exec(
            select(SharedMeterRoom).where(
                SharedMeterRoom.shared_meter_id == meter_id,
                SharedMeterRoom.room_id == room_id,
            )
        )
        if existing.first() is None:
            self.session.add(SharedMeterRoom(shared_meter_id=meter_id, room_id=room_id))
            await self.session.flush()

    async def remove_room(self, meter_id: int, room_id: int) -> None:
        result = await self.session.exec(
            select(SharedMeterRoom).where(
                SharedMeterRoom.shared_meter_id == meter_id,
                SharedMeterRoom.room_id == room_id,
            )
        )
        row = result.first()
        if row:
            await self.session.delete(row)
            await self.session.flush()

    # ── Readings ──────────────────────────────────────────────────

    async def get_reading(self, meter_id: int, period: str) -> SharedMeterReading | None:
        result = await self.session.exec(
            select(SharedMeterReading).where(
                SharedMeterReading.shared_meter_id == meter_id,
                SharedMeterReading.period == period,
            )
        )
        return result.first()

    async def get_readings_by_meter(self, meter_id: int) -> list[SharedMeterReading]:
        result = await self.session.exec(
            select(SharedMeterReading)
            .where(SharedMeterReading.shared_meter_id == meter_id)
            .order_by(SharedMeterReading.period.desc())  # type: ignore[attr-defined]
        )
        return list(result.all())

    async def create_reading(self, reading: SharedMeterReading) -> SharedMeterReading:
        self.session.add(reading)
        await self.session.flush()
        return reading

    async def update_reading(self, reading: SharedMeterReading) -> SharedMeterReading:
        self.session.add(reading)
        await self.session.flush()
        return reading
