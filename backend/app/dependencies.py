from typing import Annotated
from fastapi import Depends
from sqlmodel.ext.asyncio.session import AsyncSession
from app.database import get_session
from app.core.clerk import verify_clerk_token
from app.services.property_service import PropertyService

SessionDep = Annotated[AsyncSession, Depends(get_session)]
CurrentUserDep = Annotated[str, Depends(verify_clerk_token)]
PropertyServiceDep = Annotated[PropertyService, Depends()]
