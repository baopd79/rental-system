from pydantic import BaseModel, ConfigDict
from decimal import Decimal


class SharedMeterCreate(BaseModel):
    name: str


class SharedMeterUpdate(BaseModel):
    name: str


class SharedMeterRead(BaseModel):
    id: int
    property_id: int
    name: str
    room_ids: list[int] = []


class SharedMeterRoomAdd(BaseModel):
    room_id: int


class SharedMeterReadingCreate(BaseModel):
    shared_meter_id: int
    period: str
    curr_reading: Decimal


class SharedMeterReadingRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    shared_meter_id: int
    period: str
    prev_reading: Decimal | None
    curr_reading: Decimal
    is_prev_auto: bool
