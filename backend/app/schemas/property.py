from pydantic import BaseModel
from decimal import Decimal
from datetime import datetime
from app.models.property import WaterCalcType


class RoomInPropertyCreate(BaseModel):
    room_number: str
    floor: int | None = None
    area_m2: Decimal | None = None
    rent_price: Decimal
    deposit: Decimal = Decimal("0")


class PropertyCreate(BaseModel):
    name: str
    address: str
    description: str | None = None
    default_elec_rate: Decimal = Decimal("0")
    default_water_rate: Decimal = Decimal("0")
    water_calc_type: WaterCalcType = WaterCalcType.per_meter
    rooms: list[RoomInPropertyCreate] = []


class PropertyUpdate(BaseModel):
    name: str | None = None
    address: str | None = None
    description: str | None = None
    default_elec_rate: Decimal | None = None
    default_water_rate: Decimal | None = None
    water_calc_type: WaterCalcType | None = None


class PropertyRead(BaseModel):
    id: int
    clerk_user_id: str
    name: str
    address: str
    description: str | None
    default_elec_rate: Decimal
    default_water_rate: Decimal
    water_calc_type: WaterCalcType
    created_at: datetime

    model_config = {"from_attributes": True}
