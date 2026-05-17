from pydantic import BaseModel
from decimal import Decimal
from datetime import date
from app.models.room import RoomStatus


class RoomCreate(BaseModel):
    room_number: str
    floor: int | None = None
    area_m2: Decimal | None = None
    rent_price: Decimal
    deposit: Decimal = Decimal("0")


class RoomUpdate(BaseModel):
    room_number: str | None = None
    floor: int | None = None
    area_m2: Decimal | None = None
    rent_price: Decimal | None = None
    deposit: Decimal | None = None
    status: RoomStatus | None = None


class ActiveContractInfo(BaseModel):
    id: int
    tenant_name: str
    agreed_rent: Decimal
    start_date: date
    end_date: date
    num_people: int


class RoomRead(BaseModel):
    id: int
    property_id: int
    room_number: str
    floor: int | None
    area_m2: Decimal | None
    rent_price: Decimal
    deposit: Decimal
    status: RoomStatus
    active_contract: ActiveContractInfo | None = None

    model_config = {"from_attributes": True}
