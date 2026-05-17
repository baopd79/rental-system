from pydantic import BaseModel
from decimal import Decimal
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
    # Reading for this period
    reading_id: int | None
    elec_prev: Decimal | None
    elec_curr: Decimal | None
    water_prev: Decimal | None
    water_curr: Decimal | None
    # Previous month reading — shown as reference before user saves current period
    prev_elec_curr: Decimal | None
    prev_water_curr: Decimal | None
    # Invoice for this period
    invoice_id: int | None
    invoice_status: InvoiceStatus | None
    invoice_total: Decimal | None
    public_token: str | None


class BatchReadingItem(BaseModel):
    room_id: int
    elec_curr: Decimal
    water_curr: Decimal | None = None


class BatchReadingRequest(BaseModel):
    period: str   # "YYYY-MM"
    readings: list[BatchReadingItem]


class BatchInvoiceRequest(BaseModel):
    period: str   # "YYYY-MM"


class BatchInvoiceResult(BaseModel):
    created: int
    skipped: int
    errors: list[str]
