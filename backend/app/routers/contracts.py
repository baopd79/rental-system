from fastapi import APIRouter
from app.dependencies import CurrentUserDep, ContractServiceDep
from app.schemas.contract import ContractCreate, ContractRead

router = APIRouter(tags=["contracts"])


@router.get("/rooms/{room_id}/contracts", response_model=list[ContractRead])
async def list_room_contracts(room_id: int, clerk_user_id: CurrentUserDep, service: ContractServiceDep):
    return await service.list_contracts_by_room(room_id, clerk_user_id)


@router.post("/contracts", response_model=ContractRead, status_code=201)
async def create_contract(body: ContractCreate, clerk_user_id: CurrentUserDep, service: ContractServiceDep):
    return await service.create_contract(body, clerk_user_id)


@router.put("/contracts/{contract_id}/end", response_model=ContractRead)
async def end_contract(contract_id: int, clerk_user_id: CurrentUserDep, service: ContractServiceDep):
    return await service.end_contract(contract_id, clerk_user_id)
