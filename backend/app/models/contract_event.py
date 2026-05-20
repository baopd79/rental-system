from sqlmodel import SQLModel, Field
from datetime import datetime, timezone


class ContractEvent(SQLModel, table=True):
    __tablename__ = "contract_event"

    id: int | None = Field(default=None, primary_key=True)
    contract_id: int = Field(foreign_key="contract.id", index=True)
    event_type: str = Field(max_length=30)  # created | rent_changed | people_changed | ended
    old_value: str | None = Field(default=None, max_length=200)
    new_value: str | None = Field(default=None, max_length=200)
    occurred_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc).replace(tzinfo=None)
    )
