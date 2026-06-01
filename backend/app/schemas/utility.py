import re
from pydantic import BaseModel, field_validator
from decimal import Decimal
from app.schemas._validators import strip_required, non_negative


_PERIOD_RE = re.compile(r"^\d{4}-(0[1-9]|1[0-2])$")


def _validate_period(v: object) -> object:
    if not isinstance(v, str):
        return v
    v = strip_required(v)
    if not _PERIOD_RE.match(v):
        raise ValueError("period must be in YYYY-MM format")
    return v


class UtilityReadingCreate(BaseModel):
    room_id: int
    period: str  # "YYYY-MM"
    elec_curr: Decimal
    elec_prev: Decimal | None = None  # required only for first reading
    water_curr: Decimal | None = None  # ignored if water_calc_type != per_meter
    water_prev: Decimal | None = None  # ignored if water_calc_type != per_meter

    @field_validator("period", mode="before")
    @classmethod
    def validate_period(cls, v: object) -> object:
        return _validate_period(v)

    @field_validator(
        "elec_curr", "elec_prev", "water_curr", "water_prev", mode="before"
    )
    @classmethod
    def validate_amount(cls, v: object) -> object:
        return non_negative(v)


class UtilityReadingUpdate(BaseModel):
    elec_curr: Decimal | None = None
    water_curr: Decimal | None = None

    @field_validator("elec_curr", "water_curr", mode="before")
    @classmethod
    def validate_amount(cls, v: object) -> object:
        return non_negative(v)


class UtilityReadingRead(BaseModel):
    id: int
    room_id: int
    period: str
    elec_prev: Decimal | None
    elec_curr: Decimal
    water_prev: Decimal | None
    water_curr: Decimal | None
    is_prev_auto: bool
    contract_id: int | None = None
    tenant_name: str | None = None

    model_config = {"from_attributes": True}
