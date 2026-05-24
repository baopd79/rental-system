from typing import Any
from sqlalchemy import text
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from app.models.property import Property


class PropertyRepo:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_all(self, clerk_user_id: str) -> list[Property]:
        result = await self.session.exec(
            select(Property).where(Property.clerk_user_id == clerk_user_id)
        )
        return list(result.all())

    async def get_by_id(self, property_id: int) -> Property | None:
        return await self.session.get(Property, property_id)

    async def get_by_name(self, clerk_user_id: str, name: str) -> Property | None:
        result = await self.session.exec(
            select(Property).where(
                Property.clerk_user_id == clerk_user_id, Property.name == name
            )
        )
        return result.first()

    async def create(self, prop: Property) -> Property:
        self.session.add(prop)
        await self.session.flush()
        return prop

    async def update(self, prop: Property) -> Property:
        self.session.add(prop)
        await self.session.flush()
        return prop

    async def delete(self, prop: Property) -> None:
        await self.session.delete(prop)
        await self.session.flush()

    async def get_stats(self, clerk_user_id: str, period: str) -> list[Any]:
        result = await self.session.exec(
            text("""
            SELECT
                p.id,
                COUNT(r.id)                                          AS total_rooms,
                COUNT(CASE WHEN r.status = 'occupied' THEN 1 END)   AS occupied_rooms,
                COALESCE((
                    SELECT SUM(i.total)
                    FROM invoice i
                    JOIN contract c2 ON c2.id = i.contract_id
                    JOIN room r2 ON r2.id = c2.room_id
                    WHERE r2.property_id = p.id
                      AND i.status = 'paid'
                      AND i.period = :period
                ), 0) AS monthly_revenue
            FROM property p
            LEFT JOIN room r ON r.property_id = p.id
            WHERE p.clerk_user_id = :uid
            GROUP BY p.id
            ORDER BY p.id
            """),
            params={"uid": clerk_user_id, "period": period},
        )
        return list(result.fetchall())
