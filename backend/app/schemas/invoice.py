from pydantic import BaseModel
from decimal import Decimal
from datetime import datetime
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
    payment_reported_at: datetime | None = None
    items: list[InvoiceItemRead] = []

    model_config = {"from_attributes": True}


class InvoiceListRead(InvoiceRead):
    """InvoiceRead enriched with context for list views."""
    room_id: int
    room_number: str
    property_name: str
    tenant_name: str
    payment_reported_at: datetime | None = None


class InvoiceDetailRead(InvoiceListRead):
    """Full detail view — adds tenant phone and meter readings."""
    tenant_phone: str | None = None
    elec_prev: Decimal | None = None
    elec_curr: Decimal | None = None
    water_prev: Decimal | None = None
    water_curr: Decimal | None = None


class InvoicePublicRead(InvoiceRead):
    """InvoiceRead for public (unauthenticated) tenant-facing views.
    Excludes sensitive fields (CCCD, full phone). Includes bank transfer info.
    payment_reported_at is set when tenant clicks "I have paid" — landlord must confirm.
    """
    room_number: str
    property_name: str
    tenant_name: str
    bank_account_no: str | None
    bank_name: str | None
    bank_holder: str | None


class InvoiceGenerateRequest(BaseModel):
    contract_id: int
    period: str      # "YYYY-MM"


class InvoiceStatusUpdate(BaseModel):
    status: InvoiceStatus
