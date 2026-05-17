from pydantic import BaseModel
from datetime import date


class TenantCreate(BaseModel):
    full_name: str
    cccd: str | None = None
    phone: str | None = None
    email: str | None = None
    date_of_birth: date | None = None


class TenantUpdate(BaseModel):
    full_name: str | None = None
    cccd: str | None = None
    phone: str | None = None
    email: str | None = None
    date_of_birth: date | None = None


class TenantRead(BaseModel):
    id: int
    full_name: str
    cccd: str | None
    phone: str | None
    email: str | None
    date_of_birth: date | None

    model_config = {"from_attributes": True}
