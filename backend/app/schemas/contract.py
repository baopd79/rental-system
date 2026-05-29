from pydantic import BaseModel, field_validator, model_validator
from decimal import Decimal
from datetime import date, datetime
from app.models.contract import ContractStatus
from app.models.contract_event import ContractEventType
from app.schemas.tenant import TenantRead
from app.schemas._validators import non_negative, positive


class ContractCreate(BaseModel):
    room_id: int
    tenant_id: int
    start_date: date
    end_date: date
    agreed_rent: Decimal
    deposit: Decimal = Decimal("0")
    num_people: int = 1
    initial_elec_curr: Decimal
    initial_water_curr: Decimal | None = None

    @field_validator("agreed_rent", mode="before")
    @classmethod
    def validate_agreed_rent(cls, v: object) -> object:
        return positive(v)

    @field_validator("deposit", "initial_elec_curr", "initial_water_curr", mode="before")
    @classmethod
    def validate_non_negative(cls, v: object) -> object:
        return non_negative(v)

    @field_validator("num_people", mode="before")
    @classmethod
    def validate_num_people(cls, v: object) -> object:
        if v is not None and int(v) < 1:
            raise ValueError("must be >= 1")
        return v

    @model_validator(mode="after")
    def validate_dates(self) -> "ContractCreate":
        if self.end_date <= self.start_date:
            raise ValueError("end_date must be after start_date")
        return self


class ContractUpdate(BaseModel):
    end_date: date | None = None
    agreed_rent: Decimal | None = None
    deposit: Decimal | None = None
    num_people: int | None = None

    @field_validator("agreed_rent", mode="before")
    @classmethod
    def validate_agreed_rent(cls, v: object) -> object:
        return positive(v)

    @field_validator("deposit", mode="before")
    @classmethod
    def validate_deposit(cls, v: object) -> object:
        return non_negative(v)

    @field_validator("num_people", mode="before")
    @classmethod
    def validate_num_people(cls, v: object) -> object:
        if v is not None and int(v) < 1:
            raise ValueError("must be >= 1")
        return v


class ContractRead(BaseModel):
    id: int
    room_id: int
    tenant_id: int
    start_date: date
    end_date: date
    agreed_rent: Decimal
    deposit: Decimal
    num_people: int
    status: ContractStatus
    tenant: TenantRead

    model_config = {"from_attributes": True}


class ContractReadWithRoom(ContractRead):
    room_number: str
    property_name: str
    property_id: int


class ContractListItem(BaseModel):
    id: int
    status: ContractStatus
    start_date: date
    end_date: date
    agreed_rent: Decimal
    deposit: Decimal
    num_people: int
    tenant_id: int
    tenant_name: str
    tenant_phone: str | None
    room_id: int
    room_number: str
    property_id: int
    property_name: str


class ContractEventRead(BaseModel):
    id: int
    contract_id: int
    event_type: ContractEventType
    old_value: str | None
    new_value: str | None
    occurred_at: datetime

    model_config = {"from_attributes": True}
