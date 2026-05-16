from decimal import Decimal
from fastapi import Depends
from sqlmodel.ext.asyncio.session import AsyncSession
from app.database import get_session
from app.models.room import Room
from app.schemas.room import RoomCreate, RoomRead, RoomUpdate
from app.repositories import room_repo, property_repo
from app.core.exceptions import NotFoundException, ForbiddenException


def _build_read(room: Room, elec_fallback: Decimal, water_fallback: Decimal) -> RoomRead:
    return RoomRead(
        **room.model_dump(),
        effective_elec_rate=room.elec_rate if room.elec_rate is not None else elec_fallback,
        effective_water_rate=water_fallback,
    )


class RoomService:
    def __init__(self, session: AsyncSession = Depends(get_session)):
        self.session = session

    async def _get_property_owned(self, property_id: int, clerk_user_id: str):
        prop = await property_repo.get_by_id(self.session, property_id)
        if not prop:
            raise NotFoundException("Property not found")
        if prop.clerk_user_id != clerk_user_id:
            raise ForbiddenException()
        return prop

    async def _get_room_owned(self, room_id: int, clerk_user_id: str):
        room = await room_repo.get_by_id(self.session, room_id)
        if not room:
            raise NotFoundException("Room not found")
        prop = await property_repo.get_by_id(self.session, room.property_id)
        if not prop or prop.clerk_user_id != clerk_user_id:
            raise ForbiddenException()
        return room, prop

    async def list_rooms(self, property_id: int, clerk_user_id: str) -> list[RoomRead]:
        prop = await self._get_property_owned(property_id, clerk_user_id)
        rooms = await room_repo.get_all_by_property(self.session, property_id)
        return [_build_read(r, prop.default_elec_rate, prop.default_water_rate) for r in rooms]

    async def get_room(self, room_id: int, clerk_user_id: str) -> RoomRead:
        room, prop = await self._get_room_owned(room_id, clerk_user_id)
        return _build_read(room, prop.default_elec_rate, prop.default_water_rate)

    async def create_room(self, property_id: int, data: RoomCreate, clerk_user_id: str) -> RoomRead:
        prop = await self._get_property_owned(property_id, clerk_user_id)
        room = Room(**data.model_dump(), property_id=property_id)
        created = await room_repo.create(self.session, room)
        await self.session.commit()
        await self.session.refresh(created)
        return _build_read(created, prop.default_elec_rate, prop.default_water_rate)

    async def update_room(self, room_id: int, data: RoomUpdate, clerk_user_id: str) -> RoomRead:
        room, prop = await self._get_room_owned(room_id, clerk_user_id)
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(room, field, value)
        updated = await room_repo.update(self.session, room)
        await self.session.commit()
        await self.session.refresh(updated)
        return _build_read(updated, prop.default_elec_rate, prop.default_water_rate)

    async def delete_room(self, room_id: int, clerk_user_id: str) -> None:
        room, _ = await self._get_room_owned(room_id, clerk_user_id)
        await room_repo.delete(self.session, room)
        await self.session.commit()
