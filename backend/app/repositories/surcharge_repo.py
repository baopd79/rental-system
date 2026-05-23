from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from app.models.surcharge import SurchargeTemplate


class SurchargeRepo:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_all_by_property(self, property_id: int) -> list[SurchargeTemplate]:
        result = await self.session.exec(
            select(SurchargeTemplate).where(
                SurchargeTemplate.property_id == property_id
            )
        )
        return list(result.all())

    async def get_by_id(self, surcharge_id: int) -> SurchargeTemplate | None:
        return await self.session.get(SurchargeTemplate, surcharge_id)

    async def create(self, surcharge: SurchargeTemplate) -> SurchargeTemplate:
        self.session.add(surcharge)
        await self.session.flush()
        return surcharge

    async def update(self, surcharge: SurchargeTemplate) -> SurchargeTemplate:
        self.session.add(surcharge)
        await self.session.flush()
        return surcharge

    async def delete(self, surcharge: SurchargeTemplate) -> None:
        await self.session.delete(surcharge)
        await self.session.flush()
