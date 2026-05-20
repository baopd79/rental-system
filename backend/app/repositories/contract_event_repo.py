from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from app.models.contract_event import ContractEvent


class ContractEventRepo:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(self, event: ContractEvent) -> ContractEvent:
        self.session.add(event)
        await self.session.flush()
        return event

    async def get_by_contract(self, contract_id: int) -> list[ContractEvent]:
        result = await self.session.exec(
            select(ContractEvent)
            .where(ContractEvent.contract_id == contract_id)
            .order_by(ContractEvent.occurred_at.asc())  # type: ignore[attr-defined]
        )
        return list(result.all())
