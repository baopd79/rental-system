from pydantic import BaseModel, field_validator
from decimal import Decimal
from app.models.surcharge import SurchargeCalcType
from app.schemas._validators import strip_required, strip_optional, non_negative


class SurchargeCreate(BaseModel):
    name: str
    calc_type: SurchargeCalcType
    amount: Decimal

    @field_validator("name", mode="before")
    @classmethod
    def strip_name(cls, v: object) -> object:
        return strip_required(v) if isinstance(v, str) else v

    @field_validator("amount", mode="before")
    @classmethod
    def validate_amount(cls, v: object) -> object:
        return non_negative(v)


class SurchargeUpdate(BaseModel):
    name: str | None = None
    calc_type: SurchargeCalcType | None = None
    amount: Decimal | None = None

    @field_validator("name", mode="before")
    @classmethod
    def strip_name(cls, v: object) -> object:
        return strip_optional(v) if isinstance(v, str) else v

    @field_validator("amount", mode="before")
    @classmethod
    def validate_amount(cls, v: object) -> object:
        return non_negative(v)


class SurchargeRead(BaseModel):
    id: int
    property_id: int
    name: str
    calc_type: SurchargeCalcType
    amount: Decimal

    model_config = {"from_attributes": True}
