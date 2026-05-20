from sqlmodel import SQLModel, Field
from decimal import Decimal


class SharedMeter(SQLModel, table=True):
    __tablename__ = "shared_meter"

    id: int | None = Field(default=None, primary_key=True)
    property_id: int = Field(foreign_key="property.id", index=True)
    name: str = Field(max_length=100)


class SharedMeterRoom(SQLModel, table=True):
    __tablename__ = "shared_meter_room"

    shared_meter_id: int = Field(foreign_key="shared_meter.id", primary_key=True)
    room_id: int = Field(foreign_key="room.id", primary_key=True)


class SharedMeterReading(SQLModel, table=True):
    __tablename__ = "shared_meter_reading"

    id: int | None = Field(default=None, primary_key=True)
    shared_meter_id: int = Field(foreign_key="shared_meter.id", index=True)
    period: str = Field(max_length=7)                          # YYYY-MM
    prev_reading: Decimal | None = Field(default=None, decimal_places=2, max_digits=12)
    curr_reading: Decimal = Field(decimal_places=2, max_digits=12)
    is_prev_auto: bool = Field(default=True)
