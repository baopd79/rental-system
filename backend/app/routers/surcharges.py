from fastapi import APIRouter
from app.core.dependencies import CurrentUserDep, SurchargeServiceDep
from app.schemas.surcharge import SurchargeCreate, SurchargeRead, SurchargeUpdate

router = APIRouter(tags=["surcharges"])


@router.get("/properties/{property_id}/surcharges", response_model=list[SurchargeRead])
async def list_surcharges(property_id: int, clerk_user_id: CurrentUserDep, service: SurchargeServiceDep):
    return await service.list_surcharges(property_id, clerk_user_id)


@router.post("/properties/{property_id}/surcharges", response_model=SurchargeRead, status_code=201)
async def create_surcharge(property_id: int, body: SurchargeCreate, clerk_user_id: CurrentUserDep, service: SurchargeServiceDep):
    return await service.create_surcharge(property_id, body, clerk_user_id)


@router.put("/surcharges/{surcharge_id}", response_model=SurchargeRead)
async def update_surcharge(surcharge_id: int, body: SurchargeUpdate, clerk_user_id: CurrentUserDep, service: SurchargeServiceDep):
    return await service.update_surcharge(surcharge_id, body, clerk_user_id)


@router.delete("/surcharges/{surcharge_id}", status_code=204)
async def delete_surcharge(surcharge_id: int, clerk_user_id: CurrentUserDep, service: SurchargeServiceDep):
    await service.delete_surcharge(surcharge_id, clerk_user_id)
