from pydantic import BaseModel
from decimal import Decimal
from datetime import date
from app.models.invoice import InvoiceStatus


class RoomBillingStatus(BaseModel):
    room_id: int
    room_number: str
    tenant_id: int
    tenant_name: str
    tenant_phone: str | None
    num_people: int
    contract_id: int
    agreed_rent: Decimal
    contract_start: date
    contract_end: date
    # Current period reading
    reading_id: int | None
    elec_prev: Decimal | None
    elec_curr: Decimal | None
    water_prev: Decimal | None
    water_curr: Decimal | None
    # Previous month reading — reference for UI + billing calculation
    prev_elec_prev: Decimal | None
    prev_elec_curr: Decimal | None
    prev_water_prev: Decimal | None
    prev_water_curr: Decimal | None
    # True when next period (N+1) already has a reading — editing this period is blocked
    next_reading_locked: bool
    # Invoice for current period
    invoice_id: int | None
    invoice_status: InvoiceStatus | None
    invoice_total: Decimal | None
    public_token: str | None


class BatchReadingItem(BaseModel):
    room_id: int
    elec_curr: Decimal
    water_curr: Decimal | None = None


class BatchReadingRequest(BaseModel):
    period: str  # "YYYY-MM"
    readings: list[BatchReadingItem]


class InvoicePreviewSurcharge(BaseModel):
    name: str
    amount: Decimal


class InvoicePreviewRow(BaseModel):
    room_id: int
    room_number: str
    contract_id: int
    tenant_name: str
    contract_start: date
    contract_end: date
    # Proration
    is_prorated: bool
    prorate_label: str | None  # e.g. "17/31 ngày"
    # Whether current period reading exists (electricity uses current period reading)
    has_reading: bool
    elec_prev: Decimal | None
    elec_curr: Decimal | None
    water_prev: Decimal | None
    water_curr: Decimal | None
    # Calculated amounts
    rent_amount: Decimal
    elec_amount: Decimal
    water_amount: Decimal
    shared_elec_amount: Decimal
    surcharges: list[InvoicePreviewSurcharge]
    surcharge_total: Decimal
    total: Decimal
    # Invoice status if already exists
    invoice_id: int | None
    invoice_status: InvoiceStatus | None
    invoice_public_token: str | None


class BatchInvoiceRequest(BaseModel):
    period: str  # "YYYY-MM"
    contract_ids: list[int]  # which contracts to generate for


class BatchInvoiceResult(BaseModel):
    created: int
    skipped: int
    errors: list[str]
