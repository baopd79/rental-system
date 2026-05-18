from typing import Annotated
from fastapi import Depends
from sqlmodel.ext.asyncio.session import AsyncSession
from app.database import get_session
from app.core.clerk import verify_clerk_token
from app.services.property_service import PropertyService
from app.services.room_service import RoomService
from app.services.tenant_service import TenantService
from app.services.contract_service import ContractService
from app.services.utility_service import UtilityService
from app.services.surcharge_service import SurchargeService
from app.services.invoice_service import InvoiceService
from app.services.billing_service import BillingService
from app.services.dashboard_service import DashboardService
from app.services.shared_meter_service import SharedMeterService

SessionDep = Annotated[AsyncSession, Depends(get_session)]
CurrentUserDep = Annotated[str, Depends(verify_clerk_token)]


def _property_service(session: SessionDep) -> PropertyService:
    return PropertyService(session)


def _room_service(session: SessionDep) -> RoomService:
    return RoomService(session)


def _tenant_service(session: SessionDep) -> TenantService:
    return TenantService(session)


def _contract_service(session: SessionDep) -> ContractService:
    return ContractService(session)


def _utility_service(session: SessionDep) -> UtilityService:
    return UtilityService(session)


def _surcharge_service(session: SessionDep) -> SurchargeService:
    return SurchargeService(session)


def _invoice_service(session: SessionDep) -> InvoiceService:
    return InvoiceService(session)


def _billing_service(session: SessionDep) -> BillingService:
    return BillingService(session)


def _dashboard_service(session: SessionDep) -> DashboardService:
    return DashboardService(session)


def _shared_meter_service(session: SessionDep) -> SharedMeterService:
    return SharedMeterService(session)


PropertyServiceDep = Annotated[PropertyService, Depends(_property_service)]
RoomServiceDep = Annotated[RoomService, Depends(_room_service)]
TenantServiceDep = Annotated[TenantService, Depends(_tenant_service)]
ContractServiceDep = Annotated[ContractService, Depends(_contract_service)]
UtilityServiceDep = Annotated[UtilityService, Depends(_utility_service)]
SurchargeServiceDep = Annotated[SurchargeService, Depends(_surcharge_service)]
InvoiceServiceDep = Annotated[InvoiceService, Depends(_invoice_service)]
BillingServiceDep = Annotated[BillingService, Depends(_billing_service)]
DashboardServiceDep = Annotated[DashboardService, Depends(_dashboard_service)]
SharedMeterServiceDep = Annotated[SharedMeterService, Depends(_shared_meter_service)]
