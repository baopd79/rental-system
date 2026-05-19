from sqlmodel.ext.asyncio.session import AsyncSession
from app.models.contract import Contract, ContractStatus
from app.models.contract_event import ContractEvent
from app.models.room import RoomStatus
from datetime import date
from app.schemas.contract import ContractCreate, ContractUpdate, ContractRead, ContractReadWithRoom, ContractEventRead, ContractListItem
from app.schemas.tenant import TenantRead
from app.models.utility import UtilityReading
from app.models.property import WaterCalcType
from app.repositories.contract_repo import ContractRepo
from app.repositories.contract_event_repo import ContractEventRepo
from app.repositories.room_repo import RoomRepo
from app.repositories.property_repo import PropertyRepo
from app.repositories.tenant_repo import TenantRepo
from app.repositories.utility_repo import UtilityRepo
from app.repositories.invoice_repo import InvoiceRepo
from app.core.exceptions import NotFoundException, ForbiddenException, BadRequestException


def _build_read(contract: Contract, tenant_read: TenantRead) -> ContractRead:
    return ContractRead(**contract.model_dump(), tenant=tenant_read)


class ContractService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.contract_repo = ContractRepo(session)
        self.event_repo = ContractEventRepo(session)
        self.room_repo = RoomRepo(session)
        self.property_repo = PropertyRepo(session)
        self.tenant_repo = TenantRepo(session)
        self.utility_repo = UtilityRepo(session)
        self.invoice_repo = InvoiceRepo(session)

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

    async def list_all_contracts(self, clerk_user_id: str) -> list[ContractListItem]:
        rows = await self.contract_repo.get_all_by_user(clerk_user_id)
        return [ContractListItem(**row) for row in rows]

    async def list_contracts_by_room(self, room_id: int, clerk_user_id: str) -> list[ContractRead]:
        await self._get_room_owned(room_id, clerk_user_id)
        contracts = await self.contract_repo.get_all_by_room(room_id)
        result = []
        for c in contracts:
            tenant = await self.tenant_repo.get_by_id(c.tenant_id)
            result.append(_build_read(c, TenantRead.model_validate(tenant)))
        return result

    async def list_contracts_by_tenant(self, tenant_id: int, clerk_user_id: str) -> list[ContractReadWithRoom]:
        tenant = await self.tenant_repo.get_by_id(tenant_id)
        if not tenant or tenant.clerk_user_id != clerk_user_id:
            raise NotFoundException("Tenant not found")
        rows = await self.contract_repo.get_all_by_tenant(tenant_id)
        result = []
        for row in rows:
            contract = await self.contract_repo.get_by_id(row["id"])
            read = ContractReadWithRoom(
                **contract.model_dump(),
                tenant=TenantRead.model_validate(tenant),
                room_number=row["room_number"],
                property_name=row["property_name"],
                property_id=row["property_id"],
            )
            result.append(read)
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

        prop = await self.property_repo.get_by_id(room.property_id)

        contract_data = data.model_dump(exclude={"initial_elec_curr", "initial_water_curr"})
        contract = Contract(**contract_data)
        created = await self.contract_repo.create(contract)

        await self.event_repo.create(ContractEvent(
            contract_id=created.id,
            event_type="created",
            new_value=str(data.agreed_rent),
        ))

        room.status = RoomStatus.occupied
        room.rent_price = data.agreed_rent
        room.deposit = data.deposit
        await self.room_repo.update(room)

        if data.initial_elec_curr is not None:
            period = data.start_date.strftime("%Y-%m")
            water_curr = (
                data.initial_water_curr
                if prop and prop.water_calc_type == WaterCalcType.per_meter
                else None
            )
            existing = await self.utility_repo.get_by_room_period(room.id, period)
            if existing is not None:
                existing.contract_id = created.id
                existing.elec_prev = None
                existing.elec_curr = data.initial_elec_curr
                existing.water_prev = None
                existing.water_curr = water_curr
                existing.is_prev_auto = False
                await self.utility_repo.update(existing)
            else:
                reading = UtilityReading(
                    room_id=room.id,
                    contract_id=created.id,
                    period=period,
                    elec_prev=None,
                    elec_curr=data.initial_elec_curr,
                    water_prev=None,
                    water_curr=water_curr,
                    is_prev_auto=False,
                )
                await self.utility_repo.create(reading)

        await self.session.commit()
        await self.session.refresh(created)
        return _build_read(created, TenantRead.model_validate(tenant))

    async def update_contract(self, contract_id: int, data: ContractUpdate, clerk_user_id: str) -> ContractRead:
        contract, room = await self._get_contract_owned(contract_id, clerk_user_id)
        if contract.status != ContractStatus.active:
            raise BadRequestException("Only active contracts can be updated")

        if data.agreed_rent is not None and data.agreed_rent != contract.agreed_rent:
            await self.event_repo.create(ContractEvent(
                contract_id=contract_id,
                event_type="rent_changed",
                old_value=str(contract.agreed_rent),
                new_value=str(data.agreed_rent),
            ))
            room.rent_price = data.agreed_rent
            await self.room_repo.update(room)

        if data.num_people is not None and data.num_people != contract.num_people:
            await self.event_repo.create(ContractEvent(
                contract_id=contract_id,
                event_type="people_changed",
                old_value=str(contract.num_people),
                new_value=str(data.num_people),
            ))

        if data.deposit is not None and data.deposit != contract.deposit:
            room.deposit = data.deposit
            await self.room_repo.update(room)

        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(contract, field, value)

        if data.end_date and data.end_date <= contract.start_date:
            raise BadRequestException("end_date must be after start_date")

        await self.contract_repo.update(contract)
        await self.session.commit()
        await self.session.refresh(contract)
        tenant = await self.tenant_repo.get_by_id(contract.tenant_id)
        return _build_read(contract, TenantRead.model_validate(tenant))

    async def end_contract(self, contract_id: int, clerk_user_id: str) -> ContractRead:
        contract, room = await self._get_contract_owned(contract_id, clerk_user_id)

        if contract.status == ContractStatus.ended:
            raise BadRequestException("Contract is already ended")

        unpaid = await self.invoice_repo.get_unpaid_by_contract(contract_id)
        if unpaid:
            periods = ", ".join(sorted(i.period for i in unpaid))
            raise BadRequestException(
                f"Còn {len(unpaid)} hoá đơn chưa thanh toán (kỳ: {periods}). "
                "Vui lòng xác nhận thanh toán trước khi kết thúc hợp đồng."
            )

        contract.status = ContractStatus.ended
        contract.end_date = date.today()
        room.status = RoomStatus.vacant

        await self.event_repo.create(ContractEvent(
            contract_id=contract_id,
            event_type="ended",
            new_value=str(contract.end_date),
        ))

        await self.contract_repo.update(contract)
        await self.room_repo.update(room)
        await self.session.commit()
        await self.session.refresh(contract)

        tenant = await self.tenant_repo.get_by_id(contract.tenant_id)
        return _build_read(contract, TenantRead.model_validate(tenant))

    async def get_contract_events(self, contract_id: int, clerk_user_id: str) -> list[ContractEventRead]:
        contract = await self.contract_repo.get_by_id(contract_id)
        if not contract:
            raise NotFoundException("Contract not found")
        room = await self.room_repo.get_by_id(contract.room_id)
        prop = await self.property_repo.get_by_id(room.property_id)
        if not prop or prop.clerk_user_id != clerk_user_id:
            raise ForbiddenException()
        events = await self.event_repo.get_by_contract(contract_id)
        return [ContractEventRead.model_validate(e) for e in events]
