from fastapi import APIRouter
from app.dependencies import CurrentUserDep, InvoiceServiceDep
from app.schemas.invoice import InvoiceGenerateRequest, InvoiceRead, InvoiceStatusUpdate

router = APIRouter(tags=["invoices"])


@router.get("/contracts/{contract_id}/invoices", response_model=list[InvoiceRead])
async def list_invoices(contract_id: int, clerk_user_id: CurrentUserDep, service: InvoiceServiceDep):
    return await service.list_by_contract(contract_id, clerk_user_id)


@router.post("/invoices/generate", response_model=InvoiceRead, status_code=201)
async def generate_invoice(body: InvoiceGenerateRequest, clerk_user_id: CurrentUserDep, service: InvoiceServiceDep):
    return await service.generate(body, clerk_user_id)


@router.get("/invoices/{invoice_id}", response_model=InvoiceRead)
async def get_invoice(invoice_id: int, clerk_user_id: CurrentUserDep, service: InvoiceServiceDep):
    return await service.get_invoice(invoice_id, clerk_user_id)


@router.put("/invoices/{invoice_id}/status", response_model=InvoiceRead)
async def update_invoice_status(invoice_id: int, body: InvoiceStatusUpdate, clerk_user_id: CurrentUserDep, service: InvoiceServiceDep):
    return await service.update_status(invoice_id, body, clerk_user_id)


@router.delete("/invoices/{invoice_id}", status_code=204)
async def delete_invoice(invoice_id: int, clerk_user_id: CurrentUserDep, service: InvoiceServiceDep):
    await service.delete_invoice(invoice_id, clerk_user_id)


@router.get("/invoices/public/{token}", response_model=InvoiceRead)
async def get_public_invoice(token: str, service: InvoiceServiceDep):
    return await service.get_by_public_token(token)
