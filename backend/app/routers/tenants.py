from fastapi import APIRouter, Query
from app.core.dependencies import CurrentUserDep, TenantServiceDep
from app.schemas.tenant import TenantCreate, TenantRead, TenantUpdate

router = APIRouter(tags=["tenants"])


@router.get("/tenants", response_model=list[TenantRead])
async def list_tenants(
    clerk_user_id: CurrentUserDep,
    service: TenantServiceDep,
    property_id: int | None = Query(default=None),
):
    return await service.list_tenants(clerk_user_id, property_id=property_id)


@router.post("/tenants", response_model=TenantRead, status_code=201)
async def create_tenant(body: TenantCreate, clerk_user_id: CurrentUserDep, service: TenantServiceDep):
    return await service.create_tenant(body, clerk_user_id)


@router.get("/tenants/{tenant_id}", response_model=TenantRead)
async def get_tenant(tenant_id: int, clerk_user_id: CurrentUserDep, service: TenantServiceDep):
    return await service.get_tenant(tenant_id, clerk_user_id)


@router.put("/tenants/{tenant_id}", response_model=TenantRead)
async def update_tenant(tenant_id: int, body: TenantUpdate, clerk_user_id: CurrentUserDep, service: TenantServiceDep):
    return await service.update_tenant(tenant_id, body, clerk_user_id)
