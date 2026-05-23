from fastapi import APIRouter
from app.core.dependencies import CurrentUserDep, PropertyServiceDep
from app.schemas.property import PropertyCreate, PropertyRead, PropertyUpdate

router = APIRouter(prefix="/properties", tags=["properties"])


@router.get("/stats")
async def get_property_stats(
    clerk_user_id: CurrentUserDep, service: PropertyServiceDep
):
    return await service.get_stats(clerk_user_id)


@router.get("", response_model=list[PropertyRead])
async def list_properties(clerk_user_id: CurrentUserDep, service: PropertyServiceDep):
    return await service.list_properties(clerk_user_id)


@router.post("", response_model=PropertyRead, status_code=201)
async def create_property(
    body: PropertyCreate, clerk_user_id: CurrentUserDep, service: PropertyServiceDep
):
    return await service.create_property(body, clerk_user_id)


@router.get("/{property_id}", response_model=PropertyRead)
async def get_property(
    property_id: int, clerk_user_id: CurrentUserDep, service: PropertyServiceDep
):
    return await service.get_property(property_id, clerk_user_id)


@router.put("/{property_id}", response_model=PropertyRead)
@router.patch("/{property_id}", response_model=PropertyRead)
async def update_property(
    property_id: int,
    body: PropertyUpdate,
    clerk_user_id: CurrentUserDep,
    service: PropertyServiceDep,
):
    return await service.update_property(property_id, body, clerk_user_id)


@router.delete("/{property_id}", status_code=204)
async def delete_property(
    property_id: int, clerk_user_id: CurrentUserDep, service: PropertyServiceDep
):
    await service.delete_property(property_id, clerk_user_id)
