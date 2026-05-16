from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from app.models.property import Property


async def get_all(session: AsyncSession, clerk_user_id: str) -> list[Property]:
    result = await session.exec(select(Property).where(Property.clerk_user_id == clerk_user_id))
    return list(result.all())


async def get_by_id(session: AsyncSession, property_id: int) -> Property | None:
    return await session.get(Property, property_id)


async def create(session: AsyncSession, prop: Property) -> Property:
    session.add(prop)
    return prop


async def update(session: AsyncSession, prop: Property) -> Property:
    session.add(prop)
    return prop


async def delete(session: AsyncSession, prop: Property) -> None:
    await session.delete(prop)
