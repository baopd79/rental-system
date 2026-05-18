from fastapi import APIRouter
from app.core.dependencies import CurrentUserDep, RoomServiceDep
from app.schemas.room import RoomCreate, RoomRead, RoomUpdate

router = APIRouter(tags=["rooms"])


@router.get("/properties/{property_id}/rooms", response_model=list[RoomRead])
async def list_rooms(property_id: int, clerk_user_id: CurrentUserDep, service: RoomServiceDep):
    return await service.list_rooms(property_id, clerk_user_id)


@router.post("/properties/{property_id}/rooms", response_model=RoomRead, status_code=201)
async def create_room(property_id: int, body: RoomCreate, clerk_user_id: CurrentUserDep, service: RoomServiceDep):
    return await service.create_room(property_id, body, clerk_user_id)


@router.get("/rooms/{room_id}", response_model=RoomRead)
async def get_room(room_id: int, clerk_user_id: CurrentUserDep, service: RoomServiceDep):
    return await service.get_room(room_id, clerk_user_id)


@router.put("/rooms/{room_id}", response_model=RoomRead)
async def update_room(room_id: int, body: RoomUpdate, clerk_user_id: CurrentUserDep, service: RoomServiceDep):
    return await service.update_room(room_id, body, clerk_user_id)


@router.delete("/rooms/{room_id}", status_code=204)
async def delete_room(room_id: int, clerk_user_id: CurrentUserDep, service: RoomServiceDep):
    await service.delete_room(room_id, clerk_user_id)
