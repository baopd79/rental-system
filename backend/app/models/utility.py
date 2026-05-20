from sqlmodel import SQLModel, Field
from sqlalchemy import UniqueConstraint
from decimal import Decimal


class UtilityReading(SQLModel, table=True):
    __tablename__ = "utility_reading"
    __table_args__ = (UniqueConstraint("room_id", "period", name="uq_utility_reading_room_period"),)

    id: int | None = Field(default=None, primary_key=True)
    room_id: int = Field(foreign_key="room.id", index=True)
    contract_id: int | None = Field(default=None, foreign_key="contract.id", index=True)
    period: str = Field(max_length=7)          # "YYYY-MM"
    elec_prev: Decimal | None = Field(default=None, decimal_places=2, max_digits=10)
    elec_curr: Decimal = Field(decimal_places=2, max_digits=10)
    water_prev: Decimal | None = Field(default=None, decimal_places=2, max_digits=10)
    water_curr: Decimal | None = Field(default=None, decimal_places=2, max_digits=10)
    is_prev_auto: bool = Field(default=True)
