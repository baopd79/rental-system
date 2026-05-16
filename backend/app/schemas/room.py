from pydantic import BaseModel, computed_field
from decimal import Decimal
from typing import Optional
from app.models.room import RoomStatus


class RoomCreate(BaseModel):
    room_number: str
    floor: Optional[int] = None
    area_m2: Optional[Decimal] = None
    rent_price: Decimal
    deposit: Decimal = Decimal("0")
    elec_rate: Optional[Decimal] = None
    water_rate: Optional[Decimal] = None


class RoomUpdate(BaseModel):
    room_number: Optional[str] = None
    floor: Optional[int] = None
    area_m2: Optional[Decimal] = None
    rent_price: Optional[Decimal] = None
    deposit: Optional[Decimal] = None
    status: Optional[RoomStatus] = None
    elec_rate: Optional[Decimal] = None
    water_rate: Optional[Decimal] = None


class RoomRead(BaseModel):
    id: int
    property_id: int
    room_number: str
    floor: Optional[int]
    area_m2: Optional[Decimal]
    rent_price: Decimal
    deposit: Decimal
    status: RoomStatus
    elec_rate: Optional[Decimal]
    water_rate: Optional[Decimal]
    effective_elec_rate: Decimal
    effective_water_rate: Decimal

    model_config = {"from_attributes": True}
