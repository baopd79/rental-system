from pydantic import BaseModel
from decimal import Decimal
from app.models.invoice import InvoiceStatus, InvoiceItemType


class InvoiceItemRead(BaseModel):
    id: int
    item_type: InvoiceItemType
    name: str
    unit_price: Decimal
    quantity: Decimal
    amount: Decimal

    model_config = {"from_attributes": True}


class InvoiceRead(BaseModel):
    id: int
    contract_id: int
    period: str
    total: Decimal
    status: InvoiceStatus
    public_token: str
    items: list[InvoiceItemRead] = []

    model_config = {"from_attributes": True}


class InvoiceListRead(InvoiceRead):
    """InvoiceRead enriched with context for list views."""
    room_id: int
    room_number: str
    property_name: str
    tenant_name: str


class InvoiceGenerateRequest(BaseModel):
    contract_id: int
    period: str      # "YYYY-MM"


class InvoiceStatusUpdate(BaseModel):
    status: InvoiceStatus
