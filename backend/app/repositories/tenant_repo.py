from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from app.models.tenant import Tenant


async def get_all_by_user(session: AsyncSession, clerk_user_id: str) -> list[Tenant]:
    result = await session.exec(select(Tenant).where(Tenant.clerk_user_id == clerk_user_id))
    return list(result.all())


async def get_by_id(session: AsyncSession, tenant_id: int) -> Tenant | None:
    return await session.get(Tenant, tenant_id)


async def create(session: AsyncSession, tenant: Tenant) -> Tenant:
    session.add(tenant)
    return tenant


async def update(session: AsyncSession, tenant: Tenant) -> Tenant:
    session.add(tenant)
    return tenant
