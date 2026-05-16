from sqlmodel import SQLModel, Field
from sqlalchemy import UniqueConstraint
from decimal import Decimal
from enum import Enum


class RoomStatus(str, Enum):
    vacant = "vacant"
    occupied = "occupied"
    maintenance = "maintenance"


class Room(SQLModel, table=True):
    __tablename__ = "room"
    __table_args__ = (UniqueConstraint("property_id", "room_number", name="uq_room_property_room_number"),)

    id: int | None = Field(default=None, primary_key=True)
    property_id: int = Field(foreign_key="property.id", index=True)
    room_number: str
    floor: int | None = None
    area_m2: Decimal | None = Field(default=None, decimal_places=2, max_digits=8)
    rent_price: Decimal = Field(decimal_places=0, max_digits=12)
    deposit: Decimal = Field(default=Decimal("0"), decimal_places=0, max_digits=12)
    status: RoomStatus = Field(default=RoomStatus.vacant)
    elec_rate: Decimal | None = Field(default=None, decimal_places=2, max_digits=10)
