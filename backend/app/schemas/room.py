from pydantic import BaseModel
from decimal import Decimal
from app.models.room import RoomStatus


class RoomCreate(BaseModel):
    room_number: str
    floor: int | None = None
    area_m2: Decimal | None = None
    rent_price: Decimal
    deposit: Decimal = Decimal("0")
    elec_rate: Decimal | None = None


class RoomUpdate(BaseModel):
    room_number: str | None = None
    floor: int | None = None
    area_m2: Decimal | None = None
    rent_price: Decimal | None = None
    deposit: Decimal | None = None
    status: RoomStatus | None = None
    elec_rate: Decimal | None = None


class RoomRead(BaseModel):
    id: int
    property_id: int
    room_number: str
    floor: int | None
    area_m2: Decimal | None
    rent_price: Decimal
    deposit: Decimal
    status: RoomStatus
    elec_rate: Decimal | None
    effective_elec_rate: Decimal
    effective_water_rate: Decimal

    model_config = {"from_attributes": True}
