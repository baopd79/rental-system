from pydantic import BaseModel, field_validator
from decimal import Decimal
from datetime import date
from app.models.room import RoomStatus
from app.schemas._validators import (
    strip_required,
    strip_optional,
    non_negative,
    positive,
)


class RoomCreate(BaseModel):
    room_number: str
    floor: int | None = None
    area_m2: Decimal | None = None
    rent_price: Decimal
    deposit: Decimal = Decimal("0")

    @field_validator("room_number", mode="before")
    @classmethod
    def strip_room_number(cls, v: object) -> object:
        return strip_required(v) if isinstance(v, str) else v

    @field_validator("rent_price", "deposit", mode="before")
    @classmethod
    def validate_non_negative(cls, v: object) -> object:
        return non_negative(v)

    @field_validator("area_m2", mode="before")
    @classmethod
    def validate_area(cls, v: object) -> object:
        return positive(v)


class RoomUpdate(BaseModel):
    room_number: str | None = None
    floor: int | None = None
    area_m2: Decimal | None = None
    rent_price: Decimal | None = None
    deposit: Decimal | None = None
    status: RoomStatus | None = None

    @field_validator("room_number", mode="before")
    @classmethod
    def strip_room_number(cls, v: object) -> object:
        return strip_optional(v) if isinstance(v, str) else v

    @field_validator("rent_price", "deposit", mode="before")
    @classmethod
    def validate_non_negative(cls, v: object) -> object:
        return non_negative(v)

    @field_validator("area_m2", mode="before")
    @classmethod
    def validate_area(cls, v: object) -> object:
        return positive(v)


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
    current_invoice_status: str | None = None

    model_config = {"from_attributes": True}
