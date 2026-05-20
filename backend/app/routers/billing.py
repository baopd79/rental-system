from fastapi import APIRouter
from app.core.dependencies import CurrentUserDep, BillingServiceDep
from app.schemas.billing import (
    RoomBillingStatus, BatchReadingRequest,
    BatchInvoiceRequest, BatchInvoiceResult,
    InvoicePreviewRow,
)

router = APIRouter(tags=["billing"])


@router.get("/properties/{property_id}/billing/status", response_model=list[RoomBillingStatus])
async def get_billing_status(
    property_id: int, period: str,
    clerk_user_id: CurrentUserDep, service: BillingServiceDep,
):
    return await service.get_status(property_id, period, clerk_user_id)


@router.get("/properties/{property_id}/billing/invoice-preview", response_model=list[InvoicePreviewRow])
async def get_invoice_preview(
    property_id: int, period: str,
    clerk_user_id: CurrentUserDep, service: BillingServiceDep,
):
    return await service.get_invoice_preview(property_id, period, clerk_user_id)


@router.post("/properties/{property_id}/billing/readings", response_model=list[RoomBillingStatus])
async def batch_save_readings(
    property_id: int, body: BatchReadingRequest,
    clerk_user_id: CurrentUserDep, service: BillingServiceDep,
):
    return await service.batch_save_readings(property_id, body, clerk_user_id)


@router.post("/properties/{property_id}/billing/invoices", response_model=BatchInvoiceResult)
async def batch_generate_invoices(
    property_id: int, body: BatchInvoiceRequest,
    clerk_user_id: CurrentUserDep, service: BillingServiceDep,
):
    return await service.batch_generate_invoices(property_id, body, clerk_user_id)
