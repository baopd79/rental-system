from decimal import Decimal
from fastapi import Depends
from sqlmodel.ext.asyncio.session import AsyncSession
from app.database import get_session
from app.models.utility import UtilityReading
from app.models.property import WaterCalcType
from app.schemas.utility import UtilityReadingCreate, UtilityReadingRead, UtilityReadingUpdate
from app.repositories.utility_repo import UtilityRepo
from app.repositories.room_repo import RoomRepo
from app.repositories.property_repo import PropertyRepo
from app.core.exceptions import NotFoundException, ForbiddenException, BadRequestException, ConflictException


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
    def __init__(self, session: AsyncSession = Depends(get_session)):
        self.session = session
        self.utility_repo = UtilityRepo(session)
        self.room_repo = RoomRepo(session)
        self.property_repo = PropertyRepo(session)

    async def _get_room_owned(self, room_id: int, clerk_user_id: str):
        room = await self.room_repo.get_by_id(room_id)
        if not room:
            raise NotFoundException("Room not found")
        prop = await self.property_repo.get_by_id(room.property_id)
        if not prop or prop.clerk_user_id != clerk_user_id:
            raise ForbiddenException()
        return room, prop

    async def list_readings(self, room_id: int, clerk_user_id: str) -> list[UtilityReadingRead]:
        await self._get_room_owned(room_id, clerk_user_id)
        readings = await self.utility_repo.get_all_by_room(room_id)
        return [UtilityReadingRead.model_validate(r) for r in readings]

    async def create_reading(self, data: UtilityReadingCreate, clerk_user_id: str) -> UtilityReadingRead:
        _, prop = await self._get_room_owned(data.room_id, clerk_user_id)

        if await self.utility_repo.get_by_room_period(data.room_id, data.period):
            raise ConflictException(f"Reading for period {data.period} already exists")

        # Auto-fill prev from previous month
        prev_reading = await self.utility_repo.get_by_room_period(data.room_id, _prev_period(data.period))

        if prev_reading is not None:
            elec_prev = prev_reading.elec_curr
            is_prev_auto = True
        else:
            elec_prev = None   # first reading — prev unknown
            is_prev_auto = False

        if elec_prev is not None and data.elec_curr < elec_prev:
            raise BadRequestException("elec_curr must be >= elec_prev")

        # Water: only meaningful for per_meter
        if prop.water_calc_type == WaterCalcType.per_meter:
            if prev_reading is not None:
                water_prev = prev_reading.water_curr
            else:
                water_prev = None
            water_curr = data.water_curr
            if water_prev is not None and water_curr is not None and water_curr < water_prev:
                raise BadRequestException("water_curr must be >= water_prev")
        else:
            water_prev = None
            water_curr = None

        reading = UtilityReading(
            room_id=data.room_id,
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

    async def update_reading(self, reading_id: int, data: UtilityReadingUpdate, clerk_user_id: str) -> UtilityReadingRead:
        reading = await self.utility_repo.get_by_id(reading_id)
        if not reading:
            raise NotFoundException("Reading not found")

        _, prop = await self._get_room_owned(reading.room_id, clerk_user_id)

        latest = await self.utility_repo.get_latest_by_room(reading.room_id)
        if not latest or latest.id != reading_id:
            raise ConflictException("Only the most recent reading can be updated")

        # NOTE: invoice check to be added in Phase 6

        if data.elec_curr is not None:
            if reading.elec_prev is not None and data.elec_curr < reading.elec_prev:
                raise BadRequestException("elec_curr must be >= elec_prev")
            reading.elec_curr = data.elec_curr

        if prop.water_calc_type == WaterCalcType.per_meter and data.water_curr is not None:
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

        # NOTE: invoice check to be added in Phase 6

        await self.utility_repo.delete(reading)
        await self.session.commit()
