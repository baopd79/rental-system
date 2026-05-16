from sqlmodel import SQLModel, Field
from decimal import Decimal
from datetime import datetime, timezone
from enum import Enum


class WaterCalcType(str, Enum):
    per_meter = "per_meter"
    per_person = "per_person"
    per_room = "per_room"


class Property(SQLModel, table=True):
    __tablename__ = "property"

    id: int | None = Field(default=None, primary_key=True)
    clerk_user_id: str = Field(index=True)
    name: str
    address: str
    description: str | None = None
    default_elec_rate: Decimal = Field(default=Decimal("0"), decimal_places=2, max_digits=10)
    default_water_rate: Decimal = Field(default=Decimal("0"), decimal_places=2, max_digits=10)
    water_calc_type: WaterCalcType = Field(default=WaterCalcType.per_meter)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc).replace(tzinfo=None))
