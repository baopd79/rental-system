from fastapi import Depends
from sqlmodel.ext.asyncio.session import AsyncSession
from app.database import get_session
from app.models.contract import Contract, ContractStatus
from app.models.room import RoomStatus
from app.schemas.contract import ContractCreate, ContractRead
from app.schemas.tenant import TenantRead
from app.repositories.contract_repo import ContractRepo
from app.repositories.room_repo import RoomRepo
from app.repositories.property_repo import PropertyRepo
from app.repositories.tenant_repo import TenantRepo
from app.core.exceptions import NotFoundException, ForbiddenException, BadRequestException


def _build_read(contract: Contract, tenant_read: TenantRead) -> ContractRead:
    return ContractRead(**contract.model_dump(), tenant=tenant_read)


class ContractService:
    def __init__(self, session: AsyncSession = Depends(get_session)):
        self.session = session
        self.contract_repo = ContractRepo(session)
        self.room_repo = RoomRepo(session)
        self.property_repo = PropertyRepo(session)
        self.tenant_repo = TenantRepo(session)

    async def _get_room_owned(self, room_id: int, clerk_user_id: str):
        room = await self.room_repo.get_by_id(room_id)
        if not room:
            raise NotFoundException("Room not found")
        prop = await self.property_repo.get_by_id(room.property_id)
        if not prop or prop.clerk_user_id != clerk_user_id:
            raise ForbiddenException()
        return room

    async def _get_contract_owned(self, contract_id: int, clerk_user_id: str):
        contract = await self.contract_repo.get_by_id(contract_id)
        if not contract:
            raise NotFoundException("Contract not found")
        room = await self.room_repo.get_by_id(contract.room_id)
        prop = await self.property_repo.get_by_id(room.property_id)
        if not prop or prop.clerk_user_id != clerk_user_id:
            raise ForbiddenException()
        return contract, room

    async def list_contracts_by_room(self, room_id: int, clerk_user_id: str) -> list[ContractRead]:
        await self._get_room_owned(room_id, clerk_user_id)
        contracts = await self.contract_repo.get_all_by_room(room_id)
        result = []
        for c in contracts:
            tenant = await self.tenant_repo.get_by_id(c.tenant_id)
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

        active = await self.contract_repo.get_active_by_room(data.room_id)
        if active:
            raise BadRequestException("Room already has an active contract")

        tenant = await self.tenant_repo.get_by_id(data.tenant_id)
        if not tenant or tenant.clerk_user_id != clerk_user_id:
            raise NotFoundException("Tenant not found")

        contract = Contract(**data.model_dump())
        created = await self.contract_repo.create(contract)

        room.status = RoomStatus.occupied
        await self.room_repo.update(room)

        await self.session.commit()
        await self.session.refresh(created)
        return _build_read(created, TenantRead.model_validate(tenant))

    async def end_contract(self, contract_id: int, clerk_user_id: str) -> ContractRead:
        contract, room = await self._get_contract_owned(contract_id, clerk_user_id)

        if contract.status == ContractStatus.ended:
            raise BadRequestException("Contract is already ended")

        contract.status = ContractStatus.ended
        room.status = RoomStatus.vacant

        await self.contract_repo.update(contract)
        await self.room_repo.update(room)
        await self.session.commit()
        await self.session.refresh(contract)

        tenant = await self.tenant_repo.get_by_id(contract.tenant_id)
        return _build_read(contract, TenantRead.model_validate(tenant))
