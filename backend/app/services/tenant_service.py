from fastapi import Depends
from sqlmodel.ext.asyncio.session import AsyncSession
from app.database import get_session
from app.models.tenant import Tenant
from app.schemas.tenant import TenantCreate, TenantRead, TenantUpdate
from app.repositories import tenant_repo
from app.core.exceptions import NotFoundException, ForbiddenException


class TenantService:
    def __init__(self, session: AsyncSession = Depends(get_session)):
        self.session = session

    async def _get_tenant_owned(self, tenant_id: int, clerk_user_id: str) -> Tenant:
        tenant = await tenant_repo.get_by_id(self.session, tenant_id)
        if not tenant:
            raise NotFoundException("Tenant not found")
        if tenant.clerk_user_id != clerk_user_id:
            raise ForbiddenException()
        return tenant

    async def list_tenants(self, clerk_user_id: str) -> list[TenantRead]:
        tenants = await tenant_repo.get_all_by_user(self.session, clerk_user_id)
        return [TenantRead.model_validate(t) for t in tenants]

    async def get_tenant(self, tenant_id: int, clerk_user_id: str) -> TenantRead:
        tenant = await self._get_tenant_owned(tenant_id, clerk_user_id)
        return TenantRead.model_validate(tenant)

    async def create_tenant(self, data: TenantCreate, clerk_user_id: str) -> TenantRead:
        tenant = Tenant(**data.model_dump(), clerk_user_id=clerk_user_id)
        created = await tenant_repo.create(self.session, tenant)
        await self.session.commit()
        await self.session.refresh(created)
        return TenantRead.model_validate(created)

    async def update_tenant(self, tenant_id: int, data: TenantUpdate, clerk_user_id: str) -> TenantRead:
        tenant = await self._get_tenant_owned(tenant_id, clerk_user_id)
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(tenant, field, value)
        updated = await tenant_repo.update(self.session, tenant)
        await self.session.commit()
        await self.session.refresh(updated)
        return TenantRead.model_validate(updated)
