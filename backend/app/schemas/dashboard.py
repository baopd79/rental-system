from pydantic import BaseModel


class RoomStats(BaseModel):
    total: int
    vacant: int
    occupied: int
    maintenance: int


class ExpiringContract(BaseModel):
    contract_id: int
    room_number: str
    property_name: str
    tenant_name: str
    end_date: str
    days_left: int


class UnpaidInvoiceSummary(BaseModel):
    invoice_id: int
    room_number: str
    property_name: str
    tenant_name: str
    period: str
    total: float
    status: str


class DashboardSummary(BaseModel):
    properties: int
    rooms: RoomStats
    active_contracts: int
    unpaid_invoices: int
    unpaid_total: float
    expiring_soon: int
    expiring_contracts: list[ExpiringContract]
    unpaid_invoice_list: list[UnpaidInvoiceSummary]


class RevenueMonth(BaseModel):
    month: str
    total: float


class DashboardRevenue(BaseModel):
    year: int
    months: list[RevenueMonth]
    total_year: float
