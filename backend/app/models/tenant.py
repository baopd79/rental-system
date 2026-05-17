from sqlmodel import SQLModel, Field
from datetime import date


class Tenant(SQLModel, table=True):
    __tablename__ = "tenant"

    id: int | None = Field(default=None, primary_key=True)
    clerk_user_id: str = Field(index=True)
    full_name: str
    cccd: str | None = None
    phone: str | None = None
    email: str | None = None
    date_of_birth: date | None = None
