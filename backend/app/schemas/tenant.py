from pydantic import BaseModel, field_validator
from datetime import date
from app.schemas._validators import strip_required, strip_optional, strip_to_none


class TenantCreate(BaseModel):
    full_name: str
    cccd: str | None = None
    phone: str | None = None
    email: str | None = None
    date_of_birth: date | None = None

    @field_validator("full_name", mode="before")
    @classmethod
    def strip_full_name(cls, v: object) -> object:
        return strip_required(v) if isinstance(v, str) else v

    @field_validator("cccd", "phone", "email", mode="before")
    @classmethod
    def strip_optional_fields(cls, v: object) -> object:
        return strip_to_none(v) if isinstance(v, str) else v


class TenantUpdate(BaseModel):
    full_name: str | None = None
    cccd: str | None = None
    phone: str | None = None
    email: str | None = None
    date_of_birth: date | None = None

    @field_validator("full_name", mode="before")
    @classmethod
    def strip_full_name(cls, v: object) -> object:
        return strip_optional(v) if isinstance(v, str) else v

    @field_validator("cccd", "phone", "email", mode="before")
    @classmethod
    def strip_optional_fields(cls, v: object) -> object:
        return strip_to_none(v) if isinstance(v, str) else v


class TenantRead(BaseModel):
    id: int
    full_name: str
    cccd: str | None
    phone: str | None
    email: str | None
    date_of_birth: date | None

    model_config = {"from_attributes": True}
