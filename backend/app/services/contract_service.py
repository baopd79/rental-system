from fastapi import Depends
from sqlmodel.ext.asyncio.session import AsyncSession
from app.database import get_session
from app.models.contract import Contract, ContractStatus
from app.models.room import RoomStatus
from app.schemas.contract import ContractCreate, ContractRead
from app.schemas.tenant import TenantRead
from app.repositories import contract_repo, room_repo, property_repo, tenant_repo
from app.core.exceptions import NotFoundException, ForbiddenException, BadRequestException


def _build_read(contract: Contract, tenant_read: TenantRead) -> ContractRead:
    return ContractRead(**contract.model_dump(), tenant=tenant_read)


class ContractService:
    def __init__(self, session: AsyncSession = Depends(get_session)):
        self.session = session

    async def _get_room_owned(self, room_id: int, clerk_user_id: str):
        room = await room_repo.get_by_id(self.session, room_id)
        if not room:
            raise NotFoundException("Room not found")
        prop = await property_repo.get_by_id(self.session, room.property_id)
        if not prop or prop.clerk_user_id != clerk_user_id:
            raise ForbiddenException()
        return room

    async def _get_contract_owned(self, contract_id: int, clerk_user_id: str):
        contract = await contract_repo.get_by_id(self.session, contract_id)
        if not contract:
            raise NotFoundException("Contract not found")
        room = await room_repo.get_by_id(self.session, contract.room_id)
        prop = await property_repo.get_by_id(self.session, room.property_id)
        if not prop or prop.clerk_user_id != clerk_user_id:
            raise ForbiddenException()
        return contract, room

    async def list_contracts_by_room(self, room_id: int, clerk_user_id: str) -> list[ContractRead]:
        await self._get_room_owned(room_id, clerk_user_id)
        contracts = await contract_repo.get_all_by_room(self.session, room_id)
        result = []
        for c in contracts:
            tenant = await tenant_repo.get_by_id(self.session, c.tenant_id)
            result.append(_build_read(c, TenantRead.model_validate(tenant)))
        return result

    async def create_contract(self, data: ContractCreate, clerk_user_id: str) -> ContractRead:
        room = await self._get_room_owned(data.room_id, clerk_user_id)

        if data.num_people < 1:
            raise BadRequestException("num_people must be at least 1")
        if data.end_date <= data.start_date:
            raise BadRequestException("end_date must be after start_date")
        if room.status != RoomStatus.vacant:
            raise BadRequestException("Room is not vacant")

        active = await contract_repo.get_active_by_room(self.session, data.room_id)
        if active:
            raise BadRequestException("Room already has an active contract")

        tenant = await tenant_repo.get_by_id(self.session, data.tenant_id)
        if not tenant or tenant.clerk_user_id != clerk_user_id:
            raise NotFoundException("Tenant not found")

        contract = Contract(**data.model_dump())
        created = await contract_repo.create(self.session, contract)

        room.status = RoomStatus.occupied
        await room_repo.update(self.session, room)

        await self.session.commit()
        await self.session.refresh(created)
        return _build_read(created, TenantRead.model_validate(tenant))

    async def end_contract(self, contract_id: int, clerk_user_id: str) -> ContractRead:
        contract, room = await self._get_contract_owned(contract_id, clerk_user_id)

        if contract.status == ContractStatus.ended:
            raise BadRequestException("Contract is already ended")

        contract.status = ContractStatus.ended
        room.status = RoomStatus.vacant

        await contract_repo.update(self.session, contract)
        await room_repo.update(self.session, room)
        await self.session.commit()
        await self.session.refresh(contract)

        tenant = await tenant_repo.get_by_id(self.session, contract.tenant_id)
        return _build_read(contract, TenantRead.model_validate(tenant))
