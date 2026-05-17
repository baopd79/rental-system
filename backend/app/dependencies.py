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

SessionDep = Annotated[AsyncSession, Depends(get_session)]
CurrentUserDep = Annotated[str, Depends(verify_clerk_token)]
PropertyServiceDep = Annotated[PropertyService, Depends()]
RoomServiceDep = Annotated[RoomService, Depends()]
TenantServiceDep = Annotated[TenantService, Depends()]
ContractServiceDep = Annotated[ContractService, Depends()]
UtilityServiceDep = Annotated[UtilityService, Depends()]
