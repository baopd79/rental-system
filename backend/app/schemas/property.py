from pydantic import BaseModel, field_validator
from decimal import Decimal
from datetime import datetime
from app.models.property import WaterCalcType


def _strip_required(v: str) -> str:
    v = v.strip()
    if not v:
        raise ValueError("must not be blank")
    return v


def _strip_optional(v: str | None) -> str | None:
    """Strip; raise if blank — field is required when present."""
    if v is None:
        return v
    v = v.strip()
    if not v:
        raise ValueError("must not be blank")
    return v


def _strip_to_none(v: str | None) -> str | None:
    """Strip; convert blank/empty to None — truly optional field."""
    if v is None:
        return None
    v = v.strip()
    return v if v else None


class RoomInPropertyCreate(BaseModel):
    room_number: str
    floor: int | None = None
    area_m2: Decimal | None = None
    rent_price: Decimal
    deposit: Decimal = Decimal("0")

    @field_validator("room_number", mode="before")
    @classmethod
    def strip_room_number(cls, v: object) -> object:
        return _strip_required(v) if isinstance(v, str) else v

    @field_validator("rent_price", "deposit", mode="before")
    @classmethod
    def non_negative(cls, v: object) -> object:
        if Decimal(str(v)) < 0:
            raise ValueError("must be >= 0")
        return v

    @field_validator("area_m2", mode="before")
    @classmethod
    def positive_area(cls, v: object) -> object:
        if v is not None and Decimal(str(v)) <= 0:
            raise ValueError("must be > 0")
        return v


class PropertyCreate(BaseModel):
    name: str
    address: str
    description: str | None = None
    default_elec_rate: Decimal = Decimal("0")
    default_water_rate: Decimal = Decimal("0")
    water_calc_type: WaterCalcType = WaterCalcType.per_meter
    rooms: list[RoomInPropertyCreate] = []

    @field_validator("name", "address", mode="before")
    @classmethod
    def strip_required_str(cls, v: object) -> object:
        return _strip_required(v) if isinstance(v, str) else v

    @field_validator("description", mode="before")
    @classmethod
    def strip_description(cls, v: object) -> object:
        return _strip_to_none(v) if isinstance(v, str) else v

    @field_validator("default_elec_rate", "default_water_rate", mode="before")
    @classmethod
    def non_negative_rate(cls, v: object) -> object:
        if Decimal(str(v)) < 0:
            raise ValueError("must be >= 0")
        return v


class PropertyUpdate(BaseModel):
    name: str | None = None
    address: str | None = None
    description: str | None = None
    default_elec_rate: Decimal | None = None
    default_water_rate: Decimal | None = None
    water_calc_type: WaterCalcType | None = None
    bank_account_no: str | None = None
    bank_name: str | None = None
    bank_holder: str | None = None

    @field_validator("name", "address", mode="before")
    @classmethod
    def strip_optional_str(cls, v: object) -> object:
        return _strip_optional(v) if isinstance(v, str) else v

    @field_validator(
        "description", "bank_account_no", "bank_name", "bank_holder", mode="before"
    )
    @classmethod
    def strip_to_none_str(cls, v: object) -> object:
        return _strip_to_none(v) if isinstance(v, str) else v

    @field_validator("default_elec_rate", "default_water_rate", mode="before")
    @classmethod
    def non_negative_rate(cls, v: object) -> object:
        if v is not None and Decimal(str(v)) < 0:
            raise ValueError("must be >= 0")
        return v


class PropertyStatsRead(BaseModel):
    id: int
    total_rooms: int
    occupied_rooms: int
    monthly_revenue: float
    period: str


class PropertyRead(BaseModel):
    id: int
    name: str
    address: str
    description: str | None
    default_elec_rate: Decimal
    default_water_rate: Decimal
    water_calc_type: WaterCalcType
    bank_account_no: str | None
    bank_name: str | None
    bank_holder: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
