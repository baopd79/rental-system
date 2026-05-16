from sqlmodel import SQLModel, Field
from decimal import Decimal
from datetime import datetime, timezone


class Property(SQLModel, table=True):
    __tablename__ = "property"

    id: int | None = Field(default=None, primary_key=True)
    clerk_user_id: str = Field(index=True)
    name: str
    address: str
    description: str | None = None
    default_elec_rate: Decimal = Field(default=Decimal("0"), decimal_places=2, max_digits=10)
    default_water_rate: Decimal = Field(default=Decimal("0"), decimal_places=2, max_digits=10)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc).replace(tzinfo=None))
