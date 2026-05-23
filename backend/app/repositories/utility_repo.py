from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from app.models.utility import UtilityReading


class UtilityRepo:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_room_period(
        self, room_id: int, period: str
    ) -> UtilityReading | None:
        result = await self.session.exec(
            select(UtilityReading).where(
                UtilityReading.room_id == room_id, UtilityReading.period == period
            )
        )
        return result.first()

    async def get_latest_by_room(self, room_id: int) -> UtilityReading | None:
        result = await self.session.exec(
            select(UtilityReading)
            .where(UtilityReading.room_id == room_id)
            .order_by(UtilityReading.period.desc())  # type: ignore[attr-defined]
        )
        return result.first()

    async def get_all_by_room(self, room_id: int) -> list[UtilityReading]:
        result = await self.session.exec(
            select(UtilityReading)
            .where(UtilityReading.room_id == room_id)
            .order_by(UtilityReading.period.desc())  # type: ignore[attr-defined]
        )
        return list(result.all())

    async def get_by_id(self, reading_id: int) -> UtilityReading | None:
        return await self.session.get(UtilityReading, reading_id)

    async def create(self, reading: UtilityReading) -> UtilityReading:
        self.session.add(reading)
        await self.session.flush()
        return reading

    async def update(self, reading: UtilityReading) -> UtilityReading:
        self.session.add(reading)
        await self.session.flush()
        return reading

    async def delete(self, reading: UtilityReading) -> None:
        await self.session.delete(reading)
        await self.session.flush()
