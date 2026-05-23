from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from app.models.property import Property


class PropertyRepo:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_all(self, clerk_user_id: str) -> list[Property]:
        result = await self.session.exec(select(Property).where(Property.clerk_user_id == clerk_user_id))
        return list(result.all())

    async def get_by_id(self, property_id: int) -> Property | None:
        return await self.session.get(Property, property_id)

    async def get_by_name(self, clerk_user_id: str, name: str) -> Property | None:
        result = await self.session.exec(
            select(Property).where(Property.clerk_user_id == clerk_user_id, Property.name == name)
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
