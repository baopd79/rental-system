from pydantic import BaseModel
from decimal import Decimal
from datetime import datetime


class PropertyCreate(BaseModel):
    name: str
    address: str
    description: str | None = None
    default_elec_rate: Decimal = Decimal("0")
    default_water_rate: Decimal = Decimal("0")


class PropertyUpdate(BaseModel):
    name: str | None = None
    address: str | None = None
    description: str | None = None
    default_elec_rate: Decimal | None = None
    default_water_rate: Decimal | None = None


class PropertyRead(BaseModel):
    id: int
    clerk_user_id: str
    name: str
    address: str
    description: str | None
    default_elec_rate: Decimal
    default_water_rate: Decimal
    created_at: datetime

    model_config = {"from_attributes": True}
