from sqlmodel import SQLModel, Field
from decimal import Decimal
from datetime import date
from enum import Enum


class ContractStatus(str, Enum):
    active = "active"
    ended = "ended"


class Contract(SQLModel, table=True):
    __tablename__ = "contract"

    id: int | None = Field(default=None, primary_key=True)
    room_id: int = Field(foreign_key="room.id", index=True)
    tenant_id: int = Field(foreign_key="tenant.id", index=True)
    start_date: date
    end_date: date
    agreed_rent: Decimal = Field(decimal_places=0, max_digits=12)
    deposit: Decimal = Field(default=Decimal("0"), decimal_places=0, max_digits=12)
    num_people: int = Field(default=1)
    status: ContractStatus = Field(default=ContractStatus.active)
