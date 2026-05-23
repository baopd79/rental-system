from sqlmodel.ext.asyncio.session import AsyncSession
from app.models.surcharge import SurchargeTemplate
from app.schemas.surcharge import SurchargeCreate, SurchargeRead, SurchargeUpdate
from app.repositories.surcharge_repo import SurchargeRepo
from app.repositories.property_repo import PropertyRepo
from app.core.exceptions import NotFoundException, ForbiddenException


class SurchargeService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.surcharge_repo = SurchargeRepo(session)
        self.property_repo = PropertyRepo(session)

    async def _get_property_owned(self, property_id: int, clerk_user_id: str):
        prop = await self.property_repo.get_by_id(property_id)
        if not prop:
            raise NotFoundException("Property not found")
        if prop.clerk_user_id != clerk_user_id:
            raise ForbiddenException()
        return prop

    async def _get_surcharge_owned(
        self, surcharge_id: int, clerk_user_id: str
    ) -> SurchargeTemplate:
        surcharge = await self.surcharge_repo.get_by_id(surcharge_id)
        if not surcharge:
            raise NotFoundException("Surcharge not found")
        await self._get_property_owned(surcharge.property_id, clerk_user_id)
        return surcharge

    async def list_surcharges(
        self, property_id: int, clerk_user_id: str
    ) -> list[SurchargeRead]:
        await self._get_property_owned(property_id, clerk_user_id)
        surcharges = await self.surcharge_repo.get_all_by_property(property_id)
        return [SurchargeRead.model_validate(s) for s in surcharges]

    async def create_surcharge(
        self, property_id: int, data: SurchargeCreate, clerk_user_id: str
    ) -> SurchargeRead:
        await self._get_property_owned(property_id, clerk_user_id)
        surcharge = SurchargeTemplate(**data.model_dump(), property_id=property_id)
        created = await self.surcharge_repo.create(surcharge)
        await self.session.commit()
        await self.session.refresh(created)
        return SurchargeRead.model_validate(created)

    async def update_surcharge(
        self, surcharge_id: int, data: SurchargeUpdate, clerk_user_id: str
    ) -> SurchargeRead:
        surcharge = await self._get_surcharge_owned(surcharge_id, clerk_user_id)
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(surcharge, field, value)
        updated = await self.surcharge_repo.update(surcharge)
        await self.session.commit()
        await self.session.refresh(updated)
        return SurchargeRead.model_validate(updated)

    async def delete_surcharge(self, surcharge_id: int, clerk_user_id: str) -> None:
        surcharge = await self._get_surcharge_owned(surcharge_id, clerk_user_id)
        await self.surcharge_repo.delete(surcharge)
        await self.session.commit()
