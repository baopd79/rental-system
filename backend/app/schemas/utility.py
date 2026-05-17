from pydantic import BaseModel
from decimal import Decimal


class UtilityReadingCreate(BaseModel):
    room_id: int
    period: str          # "YYYY-MM"
    elec_curr: Decimal
    elec_prev: Decimal | None = None     # required only for first reading
    water_curr: Decimal | None = None    # ignored if water_calc_type != per_meter
    water_prev: Decimal | None = None    # ignored if water_calc_type != per_meter


class UtilityReadingUpdate(BaseModel):
    elec_curr: Decimal | None = None
    water_curr: Decimal | None = None


class UtilityReadingRead(BaseModel):
    id: int
    room_id: int
    period: str
    elec_prev: Decimal | None
    elec_curr: Decimal
    water_prev: Decimal | None
    water_curr: Decimal | None
    is_prev_auto: bool

    model_config = {"from_attributes": True}
