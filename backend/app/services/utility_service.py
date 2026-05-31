from sqlmodel.ext.asyncio.session import AsyncSession
from app.models.utility import UtilityReading
from app.models.property import WaterCalcType
from app.schemas.utility import (
    UtilityReadingCreate,
    UtilityReadingRead,
    UtilityReadingUpdate,
)
from app.repositories.utility_repo import UtilityRepo
from app.repositories.room_repo import RoomRepo
from app.repositories.property_repo import PropertyRepo
from app.repositories.contract_repo import ContractRepo
from app.core.exceptions import (
    NotFoundException,
    ForbiddenException,
    BadRequestException,
    ConflictException,
)


def _prev_period(period: str) -> str:
    year, month = int(period[:4]), int(period[5:7])
    month -= 1
    if month == 0:
        month, year = 12, year - 1
    return f"{year:04d}-{month:02d}"


def _next_period(period: str) -> str:
    year, month = int(period[:4]), int(period[5:7])
    month += 1
    if month == 13:
        month, year = 1, year + 1
    return f"{year:04d}-{month:02d}"


class UtilityService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.utility_repo = UtilityRepo(session)
        self.room_repo = RoomRepo(session)
        self.property_repo = PropertyRepo(session)
        self.contract_repo = ContractRepo(session)

    async def _get_room_owned(self, room_id: int, clerk_user_id: str):
        room = await self.room_repo.get_by_id(room_id)
        if not room:
            raise NotFoundException("Room not found")
        prop = await self.property_repo.get_by_id(room.property_id)
        if not prop or prop.clerk_user_id != clerk_user_id:
            raise ForbiddenException()
        return room, prop

    async def list_readings(
        self, room_id: int, clerk_user_id: str
    ) -> list[UtilityReadingRead]:
        await self._get_room_owned(room_id, clerk_user_id)
        rows = await self.utility_repo.get_all_by_room_with_tenant(room_id)
        return [UtilityReadingRead.model_validate(row) for row in rows]

    async def create_reading(
        self, data: UtilityReadingCreate, clerk_user_id: str
    ) -> UtilityReadingRead:
        _, prop = await self._get_room_owned(data.room_id, clerk_user_id)

        if await self.utility_repo.get_by_room_period(data.room_id, data.period):
            raise ConflictException(f"Reading for period {data.period} already exists")

        # Reading must belong to the active contract of the room.
        # Reject if room is vacant — billing logic depends on contract_id linkage.
        active_contract = await self.contract_repo.get_active_by_room(data.room_id)
        if active_contract is None:
            raise BadRequestException(
                "Phòng chưa có hợp đồng đang hoạt động, không thể ghi chỉ số"
            )
        contract_id = active_contract.id

        # Only carry over prev reading if it belongs to the same contract —
        # a previous tenant's reading must never become the new tenant's elec_prev.
        prev_reading = await self.utility_repo.get_by_room_period(
            data.room_id, _prev_period(data.period)
        )
        same_contract_prev = (
            prev_reading
            if prev_reading is not None and prev_reading.contract_id == contract_id
            else None
        )

        if same_contract_prev is not None:
            elec_prev = same_contract_prev.elec_curr
            is_prev_auto = True
        else:
            elec_prev = None
            is_prev_auto = False

        if elec_prev is not None and data.elec_curr < elec_prev:
            raise BadRequestException("elec_curr must be >= elec_prev")

        if prop.water_calc_type == WaterCalcType.per_meter:
            water_prev = (
                same_contract_prev.water_curr if same_contract_prev else None
            )
            water_curr = data.water_curr
            if (
                water_prev is not None
                and water_curr is not None
                and water_curr < water_prev
            ):
                raise BadRequestException("water_curr must be >= water_prev")
        else:
            water_prev = None
            water_curr = None

        reading = UtilityReading(
            room_id=data.room_id,
            contract_id=contract_id,
            period=data.period,
            elec_prev=elec_prev,
            elec_curr=data.elec_curr,
            water_prev=water_prev,
            water_curr=water_curr,
            is_prev_auto=is_prev_auto,
        )
        created = await self.utility_repo.create(reading)
        await self.session.commit()
        await self.session.refresh(created)
        return UtilityReadingRead.model_validate(created)

    async def update_reading(
        self, reading_id: int, data: UtilityReadingUpdate, clerk_user_id: str
    ) -> UtilityReadingRead:
        reading = await self.utility_repo.get_by_id(reading_id)
        if not reading:
            raise NotFoundException("Reading not found")

        _, prop = await self._get_room_owned(reading.room_id, clerk_user_id)

        latest = await self.utility_repo.get_latest_by_room(reading.room_id)
        if not latest or latest.id != reading_id:
            raise ConflictException("Only the most recent reading can be updated")

        if data.elec_curr is not None:
            if reading.elec_prev is not None and data.elec_curr < reading.elec_prev:
                raise BadRequestException("elec_curr must be >= elec_prev")
            reading.elec_curr = data.elec_curr

        if (
            prop.water_calc_type == WaterCalcType.per_meter
            and data.water_curr is not None
        ):
            if reading.water_prev is not None and data.water_curr < reading.water_prev:
                raise BadRequestException("water_curr must be >= water_prev")
            reading.water_curr = data.water_curr

        updated = await self.utility_repo.update(reading)
        await self.session.commit()
        await self.session.refresh(updated)
        return UtilityReadingRead.model_validate(updated)

    async def delete_reading(self, reading_id: int, clerk_user_id: str) -> None:
        reading = await self.utility_repo.get_by_id(reading_id)
        if not reading:
            raise NotFoundException("Reading not found")

        await self._get_room_owned(reading.room_id, clerk_user_id)

        latest = await self.utility_repo.get_latest_by_room(reading.room_id)
        if not latest or latest.id != reading_id:
            raise ConflictException("Only the most recent reading can be deleted")

        await self.utility_repo.delete(reading)
        await self.session.commit()
