from sqlmodel import select, func
from sqlmodel.ext.asyncio.session import AsyncSession
from app.models.contract import Contract, ContractStatus


class ContractRepo:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_active_by_room(self, room_id: int) -> Contract | None:
        result = await self.session.exec(
            select(Contract).where(Contract.room_id == room_id, Contract.status == ContractStatus.active)
        )
        return result.first()

    async def get_all_by_room(self, room_id: int) -> list[Contract]:
        result = await self.session.exec(select(Contract).where(Contract.room_id == room_id))
        return list(result.all())

    async def count_by_room(self, room_id: int) -> int:
        result = await self.session.exec(select(func.count()).where(Contract.room_id == room_id))
        return result.one()

    async def get_by_id(self, contract_id: int) -> Contract | None:
        return await self.session.get(Contract, contract_id)

    async def create(self, contract: Contract) -> Contract:
        self.session.add(contract)
        await self.session.flush()
        return contract

    async def update(self, contract: Contract) -> Contract:
        self.session.add(contract)
        await self.session.flush()
        return contract
