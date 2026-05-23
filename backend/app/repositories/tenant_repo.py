from sqlmodel import select
from sqlalchemy import text
from sqlmodel.ext.asyncio.session import AsyncSession
from app.models.tenant import Tenant


class TenantRepo:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_property(
        self, property_id: int, clerk_user_id: str
    ) -> list[Tenant]:
        """Tenants who have had any contract in this property."""
        result = await self.session.exec(
            text("""
            SELECT DISTINCT t.* FROM tenant t
            JOIN contract c ON c.tenant_id = t.id
            JOIN room r ON r.id = c.room_id
            WHERE r.property_id = :property_id AND t.clerk_user_id = :uid
            ORDER BY t.full_name
        """),
            params={"property_id": property_id, "uid": clerk_user_id},
        )
        rows = result.mappings().all()
        return [Tenant(**dict(row)) for row in rows]

    async def get_all_by_user(self, clerk_user_id: str) -> list[Tenant]:
        result = await self.session.exec(
            select(Tenant).where(Tenant.clerk_user_id == clerk_user_id)
        )
        return list(result.all())

    async def get_by_id(self, tenant_id: int) -> Tenant | None:
        return await self.session.get(Tenant, tenant_id)

    async def create(self, tenant: Tenant) -> Tenant:
        self.session.add(tenant)
        await self.session.flush()
        return tenant

    async def update(self, tenant: Tenant) -> Tenant:
        self.session.add(tenant)
        await self.session.flush()
        return tenant
