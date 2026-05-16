from fastapi import Depends
from sqlmodel.ext.asyncio.session import AsyncSession
from app.database import get_session
from app.models.property import Property
from app.schemas.property import PropertyCreate, PropertyUpdate
from app.repositories import property_repo, room_repo
from app.core.exceptions import NotFoundException, ForbiddenException, ConflictException


class PropertyService:
    def __init__(self, session: AsyncSession = Depends(get_session)):
        self.session = session

    async def list_properties(self, clerk_user_id: str) -> list[Property]:
        return await property_repo.get_all(self.session, clerk_user_id)

    async def get_property(self, property_id: int, clerk_user_id: str) -> Property:
        prop = await property_repo.get_by_id(self.session, property_id)
        if not prop:
            raise NotFoundException("Property not found")
        if prop.clerk_user_id != clerk_user_id:
            raise ForbiddenException()
        return prop

    async def create_property(self, data: PropertyCreate, clerk_user_id: str) -> Property:
        prop = Property(**data.model_dump(), clerk_user_id=clerk_user_id)
        created = await property_repo.create(self.session, prop)
        await self.session.commit()
        await self.session.refresh(created)
        return created

    async def update_property(self, property_id: int, data: PropertyUpdate, clerk_user_id: str) -> Property:
        prop = await property_repo.get_by_id(self.session, property_id)
        if not prop:
            raise NotFoundException("Property not found")
        if prop.clerk_user_id != clerk_user_id:
            raise ForbiddenException()
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(prop, field, value)
        updated = await property_repo.update(self.session, prop)
        await self.session.commit()
        await self.session.refresh(updated)
        return updated

    async def delete_property(self, property_id: int, clerk_user_id: str) -> None:
        prop = await property_repo.get_by_id(self.session, property_id)
        if not prop:
            raise NotFoundException("Property not found")
        if prop.clerk_user_id != clerk_user_id:
            raise ForbiddenException()
        if await room_repo.count_by_property(self.session, property_id):
            raise ConflictException("Cannot delete property with existing rooms")
        await property_repo.delete(self.session, prop)
        await self.session.commit()
