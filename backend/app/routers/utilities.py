from fastapi import APIRouter
from app.core.dependencies import CurrentUserDep, UtilityServiceDep
from app.schemas.utility import (
    UtilityReadingCreate,
    UtilityReadingRead,
    UtilityReadingUpdate,
)

router = APIRouter(tags=["utilities"])


@router.get(
    "/rooms/{room_id}/utility-readings", response_model=list[UtilityReadingRead]
)
async def list_readings(
    room_id: int, clerk_user_id: CurrentUserDep, service: UtilityServiceDep
):
    return await service.list_readings(room_id, clerk_user_id)


@router.post("/utility-readings", response_model=UtilityReadingRead, status_code=201)
async def create_reading(
    body: UtilityReadingCreate,
    clerk_user_id: CurrentUserDep,
    service: UtilityServiceDep,
):
    return await service.create_reading(body, clerk_user_id)


@router.patch("/utility-readings/{reading_id}", response_model=UtilityReadingRead)
async def update_reading(
    reading_id: int,
    body: UtilityReadingUpdate,
    clerk_user_id: CurrentUserDep,
    service: UtilityServiceDep,
):
    return await service.update_reading(reading_id, body, clerk_user_id)


@router.delete("/utility-readings/{reading_id}", status_code=204)
async def delete_reading(
    reading_id: int, clerk_user_id: CurrentUserDep, service: UtilityServiceDep
):
    await service.delete_reading(reading_id, clerk_user_id)
