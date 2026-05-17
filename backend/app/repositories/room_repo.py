from sqlmodel import select, func
from sqlmodel.ext.asyncio.session import AsyncSession
from app.models.room import Room


class RoomRepo:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def count_by_property(self, property_id: int) -> int:
        result = await self.session.exec(select(func.count()).where(Room.property_id == property_id))
        return result.one()

    async def get_all_by_property(self, property_id: int) -> list[Room]:
        result = await self.session.exec(select(Room).where(Room.property_id == property_id))
        return list(result.all())

    async def get_by_id(self, room_id: int) -> Room | None:
        return await self.session.get(Room, room_id)

    async def create(self, room: Room) -> Room:
        self.session.add(room)
        await self.session.flush()
        return room

    async def update(self, room: Room) -> Room:
        self.session.add(room)
        await self.session.flush()
        return room

    async def delete(self, room: Room) -> None:
        await self.session.delete(room)
        await self.session.flush()
