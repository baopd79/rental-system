from sqlalchemy import text
from sqlmodel.ext.asyncio.session import AsyncSession
from datetime import date
from app.models.property import Property
from app.models.room import Room
from app.schemas.property import PropertyCreate, PropertyUpdate
from app.repositories.property_repo import PropertyRepo
from app.repositories.room_repo import RoomRepo
from app.core.exceptions import NotFoundException, ForbiddenException, ConflictException


class PropertyService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.property_repo = PropertyRepo(session)
        self.room_repo = RoomRepo(session)

    async def list_properties(self, clerk_user_id: str) -> list[Property]:
        return await self.property_repo.get_all(clerk_user_id)

    async def get_stats(self, clerk_user_id: str) -> list[dict]:
        today = date.today()
        period = f"{today.year}-{str(today.month).zfill(2)}"
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
        return [
            {
                "id": row.id,
                "total_rooms": row.total_rooms,
                "occupied_rooms": row.occupied_rooms,
                "monthly_revenue": float(row.monthly_revenue),
                "period": period,
            }
            for row in result.fetchall()
        ]

    async def get_property(self, property_id: int, clerk_user_id: str) -> Property:
        prop = await self.property_repo.get_by_id(property_id)
        if not prop:
            raise NotFoundException("Property not found")
        if prop.clerk_user_id != clerk_user_id:
            raise ForbiddenException()
        return prop

    async def create_property(
        self, data: PropertyCreate, clerk_user_id: str
    ) -> Property:
        if await self.property_repo.get_by_name(clerk_user_id, data.name):
            raise ConflictException("Tên nhà trọ đã tồn tại")
        rooms_data = data.rooms
        prop = Property(
            **data.model_dump(exclude={"rooms"}), clerk_user_id=clerk_user_id
        )
        created = await self.property_repo.create(prop)
        for r in rooms_data:
            room = Room(**r.model_dump(), property_id=created.id)
            await self.room_repo.create(room)
        await self.session.commit()
        await self.session.refresh(created)
        return created

    async def update_property(
        self, property_id: int, data: PropertyUpdate, clerk_user_id: str
    ) -> Property:
        prop = await self.property_repo.get_by_id(property_id)
        if not prop:
            raise NotFoundException("Property not found")
        if prop.clerk_user_id != clerk_user_id:
            raise ForbiddenException()
        if data.name is not None and data.name != prop.name:
            if await self.property_repo.get_by_name(clerk_user_id, data.name):
                raise ConflictException("Tên nhà trọ đã tồn tại")
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(prop, field, value)
        updated = await self.property_repo.update(prop)
        await self.session.commit()
        await self.session.refresh(updated)
        return updated

    async def delete_property(self, property_id: int, clerk_user_id: str) -> None:
        prop = await self.property_repo.get_by_id(property_id)
        if not prop:
            raise NotFoundException("Property not found")
        if prop.clerk_user_id != clerk_user_id:
            raise ForbiddenException()
        if await self.room_repo.count_by_property(property_id):
            raise ConflictException("Cannot delete property with existing rooms")
        await self.property_repo.delete(prop)
        await self.session.commit()
