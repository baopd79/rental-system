from pydantic import BaseModel
from decimal import Decimal
from datetime import date
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
