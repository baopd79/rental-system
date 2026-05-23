from sqlmodel import SQLModel, Field
from sqlalchemy import UniqueConstraint
from decimal import Decimal
from datetime import datetime, timezone
from enum import Enum


class WaterCalcType(str, Enum):
    per_meter = "per_meter"
    per_person = "per_person"
    per_room = "per_room"


class Property(SQLModel, table=True):
    __tablename__ = "property"
    __table_args__ = (
        UniqueConstraint("clerk_user_id", "name", name="uq_property_user_name"),
    )

    id: int | None = Field(default=None, primary_key=True)
    clerk_user_id: str = Field(index=True)
    name: str = Field(min_length=1, max_length=150)
    address: str = Field(min_length=1, max_length=300)
    description: str | None = None
    default_elec_rate: Decimal = Field(
        default=Decimal("0"), decimal_places=2, max_digits=10
    )
    default_water_rate: Decimal = Field(
        default=Decimal("0"), decimal_places=2, max_digits=10
    )
    water_calc_type: WaterCalcType = Field(default=WaterCalcType.per_meter)
    bank_account_no: str | None = Field(default=None, max_length=30)
    bank_name: str | None = Field(default=None, max_length=100)
    bank_holder: str | None = Field(default=None, max_length=100)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc).replace(tzinfo=None)
    )
