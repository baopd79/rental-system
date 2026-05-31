from sqlmodel import select
from sqlalchemy import text
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
            .limit(1)
        )
        return result.first()

    async def get_all_by_room_with_tenant(self, room_id: int) -> list[dict]:
        """List readings + tenant name in 1 query (avoids N+1 over contracts/tenants)."""
        result = await self.session.exec(
            text("""
            SELECT u.id, u.room_id, u.period, u.elec_prev, u.elec_curr,
                   u.water_prev, u.water_curr, u.is_prev_auto, u.contract_id,
                   t.full_name AS tenant_name
            FROM utility_reading u
            LEFT JOIN contract c ON c.id = u.contract_id
            LEFT JOIN tenant t ON t.id = c.tenant_id
            WHERE u.room_id = :room_id
            ORDER BY u.period DESC
        """),
            params={"room_id": room_id},
        )
        return [dict(row) for row in result.mappings().all()]

    async def get_by_id(self, reading_id: int) -> UtilityReading | None:
        return await self.session.get(UtilityReading, reading_id)

    async def create(self, reading: UtilityReading) -> UtilityReading:
        self.session.add(reading)
        await self.session.flush()
        return reading

    async def update(self, reading: UtilityReading) -> UtilityReading:
        await self.session.flush()
        return reading

    async def delete(self, reading: UtilityReading) -> None:
        await self.session.delete(reading)
        await self.session.flush()
