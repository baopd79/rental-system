from sqlmodel import select, func
from sqlmodel.ext.asyncio.session import AsyncSession
from app.models.room import Room


async def count_by_property(session: AsyncSession, property_id: int) -> int:
    result = await session.exec(select(func.count()).where(Room.property_id == property_id))
    return result.one()


async def get_all_by_property(session: AsyncSession, property_id: int) -> list[Room]:
    result = await session.exec(select(Room).where(Room.property_id == property_id))
    return list(result.all())


async def get_by_id(session: AsyncSession, room_id: int) -> Room | None:
    return await session.get(Room, room_id)


async def create(session: AsyncSession, room: Room) -> Room:
    session.add(room)
    return room


async def update(session: AsyncSession, room: Room) -> Room:
    session.add(room)
    return room


async def delete(session: AsyncSession, room: Room) -> None:
    await session.delete(room)
