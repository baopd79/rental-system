from fastapi import APIRouter
from app.core.dependencies import CurrentUserDep, ContractServiceDep
from app.schemas.contract import (
    ContractCreate,
    ContractRead,
    ContractUpdate,
    ContractReadWithRoom,
    ContractEventRead,
    ContractListItem,
)

router = APIRouter(tags=["contracts"])


@router.get("/contracts", response_model=list[ContractListItem])
async def list_all_contracts(
    clerk_user_id: CurrentUserDep, service: ContractServiceDep
):
    return await service.list_all_contracts(clerk_user_id)


@router.get("/rooms/{room_id}/contracts", response_model=list[ContractRead])
async def list_room_contracts(
    room_id: int, clerk_user_id: CurrentUserDep, service: ContractServiceDep
):
    return await service.list_contracts_by_room(room_id, clerk_user_id)


@router.get("/tenants/{tenant_id}/contracts", response_model=list[ContractReadWithRoom])
async def list_tenant_contracts(
    tenant_id: int, clerk_user_id: CurrentUserDep, service: ContractServiceDep
):
    return await service.list_contracts_by_tenant(tenant_id, clerk_user_id)


@router.get("/contracts/{contract_id}/events", response_model=list[ContractEventRead])
async def get_contract_events(
    contract_id: int, clerk_user_id: CurrentUserDep, service: ContractServiceDep
):
    return await service.get_contract_events(contract_id, clerk_user_id)


@router.post("/contracts", response_model=ContractRead, status_code=201)
async def create_contract(
    body: ContractCreate, clerk_user_id: CurrentUserDep, service: ContractServiceDep
):
    return await service.create_contract(body, clerk_user_id)


@router.patch("/contracts/{contract_id}", response_model=ContractRead)
async def update_contract(
    contract_id: int,
    body: ContractUpdate,
    clerk_user_id: CurrentUserDep,
    service: ContractServiceDep,
):
    return await service.update_contract(contract_id, body, clerk_user_id)


@router.put("/contracts/{contract_id}/end", response_model=ContractRead)
async def end_contract(
    contract_id: int, clerk_user_id: CurrentUserDep, service: ContractServiceDep
):
    return await service.end_contract(contract_id, clerk_user_id)
