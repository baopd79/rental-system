from sqlmodel import SQLModel, Field
from sqlalchemy import UniqueConstraint
from decimal import Decimal
from enum import Enum


class SurchargeCalcType(str, Enum):
    per_room = "per_room"
    per_person = "per_person"


class SurchargeTemplate(SQLModel, table=True):
    __tablename__ = "surcharge_template"
    __table_args__ = (
        UniqueConstraint("property_id", "name", name="uq_surcharge_property_name"),
    )

    id: int | None = Field(default=None, primary_key=True)
    property_id: int = Field(foreign_key="property.id", index=True)
    name: str = Field(min_length=1, max_length=150)
    calc_type: SurchargeCalcType
    amount: Decimal = Field(decimal_places=0, max_digits=12)
