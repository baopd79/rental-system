from pydantic import BaseModel
from decimal import Decimal
from app.models.surcharge import SurchargeCalcType


class SurchargeCreate(BaseModel):
    name: str
    calc_type: SurchargeCalcType
    amount: Decimal


class SurchargeUpdate(BaseModel):
    name: str | None = None
    calc_type: SurchargeCalcType | None = None
    amount: Decimal | None = None


class SurchargeRead(BaseModel):
    id: int
    property_id: int
    name: str
    calc_type: SurchargeCalcType
    amount: Decimal

    model_config = {"from_attributes": True}
