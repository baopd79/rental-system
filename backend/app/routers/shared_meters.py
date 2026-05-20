from fastapi import APIRouter
from app.core.dependencies import CurrentUserDep, SharedMeterServiceDep
from app.schemas.shared_meter import (
    SharedMeterCreate, SharedMeterUpdate, SharedMeterRead,
    SharedMeterRoomAdd, SharedMeterReadingCreate, SharedMeterReadingRead,
)

router = APIRouter(tags=["shared-meters"])


@router.get("/properties/{property_id}/shared-meters", response_model=list[SharedMeterRead])
async def list_shared_meters(
    property_id: int,
    clerk_user_id: CurrentUserDep,
    service: SharedMeterServiceDep,
) -> list[SharedMeterRead]:
    return await service.list_meters(property_id, clerk_user_id)


@router.post("/properties/{property_id}/shared-meters", response_model=SharedMeterRead, status_code=201)
async def create_shared_meter(
    property_id: int,
    data: SharedMeterCreate,
    clerk_user_id: CurrentUserDep,
    service: SharedMeterServiceDep,
) -> SharedMeterRead:
    return await service.create_meter(property_id, data, clerk_user_id)


@router.put("/shared-meters/{meter_id}", response_model=SharedMeterRead)
async def update_shared_meter(
    meter_id: int,
    data: SharedMeterUpdate,
    clerk_user_id: CurrentUserDep,
    service: SharedMeterServiceDep,
) -> SharedMeterRead:
    return await service.update_meter(meter_id, data, clerk_user_id)


@router.delete("/shared-meters/{meter_id}", status_code=204)
async def delete_shared_meter(
    meter_id: int,
    clerk_user_id: CurrentUserDep,
    service: SharedMeterServiceDep,
) -> None:
    await service.delete_meter(meter_id, clerk_user_id)


@router.post("/shared-meters/{meter_id}/rooms", response_model=SharedMeterRead)
async def add_room_to_meter(
    meter_id: int,
    data: SharedMeterRoomAdd,
    clerk_user_id: CurrentUserDep,
    service: SharedMeterServiceDep,
) -> SharedMeterRead:
    return await service.add_room(meter_id, data.room_id, clerk_user_id)


@router.delete("/shared-meters/{meter_id}/rooms/{room_id}", response_model=SharedMeterRead)
async def remove_room_from_meter(
    meter_id: int,
    room_id: int,
    clerk_user_id: CurrentUserDep,
    service: SharedMeterServiceDep,
) -> SharedMeterRead:
    return await service.remove_room(meter_id, room_id, clerk_user_id)


@router.post("/shared-meter-readings", response_model=SharedMeterReadingRead, status_code=200)
async def upsert_shared_meter_reading(
    data: SharedMeterReadingCreate,
    clerk_user_id: CurrentUserDep,
    service: SharedMeterServiceDep,
) -> SharedMeterReadingRead:
    return await service.upsert_reading(data, clerk_user_id)


@router.get("/shared-meters/{meter_id}/readings", response_model=list[SharedMeterReadingRead])
async def list_shared_meter_readings(
    meter_id: int,
    clerk_user_id: CurrentUserDep,
    service: SharedMeterServiceDep,
) -> list[SharedMeterReadingRead]:
    return await service.list_readings(meter_id, clerk_user_id)
