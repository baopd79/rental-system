from sqlmodel import SQLModel, Field
from decimal import Decimal
from datetime import datetime
from enum import Enum
import uuid


class InvoiceStatus(str, Enum):
    draft = "draft"
    sent = "sent"
    paid = "paid"


class InvoiceItemType(str, Enum):
    rent = "rent"
    electricity = "electricity"
    water = "water"
    surcharge = "surcharge"
    shared_elec = "shared_elec"


class Invoice(SQLModel, table=True):
    __tablename__ = "invoice"

    id: int | None = Field(default=None, primary_key=True)
    contract_id: int = Field(foreign_key="contract.id", index=True)
    period: str = Field(max_length=7)              # "YYYY-MM"
    total: Decimal = Field(decimal_places=0, max_digits=14)
    status: InvoiceStatus = Field(default=InvoiceStatus.draft)
    public_token: str = Field(default_factory=lambda: str(uuid.uuid4()), index=True)
    payment_reported_at: datetime | None = Field(default=None)


class InvoiceItem(SQLModel, table=True):
    __tablename__ = "invoice_item"

    id: int | None = Field(default=None, primary_key=True)
    invoice_id: int = Field(foreign_key="invoice.id", index=True)
    item_type: InvoiceItemType
    name: str
    unit_price: Decimal = Field(decimal_places=2, max_digits=14)
    quantity: Decimal = Field(default=Decimal("1"), decimal_places=2, max_digits=10)
    amount: Decimal = Field(decimal_places=0, max_digits=14)
