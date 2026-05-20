from pydantic import BaseModel
from decimal import Decimal
from datetime import date, datetime
from app.models.contract import ContractStatus
from app.schemas.tenant import TenantRead


class ContractCreate(BaseModel):
    room_id: int
    tenant_id: int
    start_date: date
    end_date: date
    agreed_rent: Decimal
    deposit: Decimal = Decimal("0")
    num_people: int = 1
    initial_elec_curr: Decimal | None = None
    initial_water_curr: Decimal | None = None


class ContractUpdate(BaseModel):
    end_date: date | None = None
    agreed_rent: Decimal | None = None
    deposit: Decimal | None = None
    num_people: int | None = None


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
    event_type: str
    old_value: str | None
    new_value: str | None
    occurred_at: datetime

    model_config = {"from_attributes": True}
