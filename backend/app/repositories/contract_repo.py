from sqlmodel import select, func
from sqlalchemy import text
from sqlmodel.ext.asyncio.session import AsyncSession
from app.models.contract import Contract, ContractStatus


class ContractRepo:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_active_by_property(self, property_id: int) -> dict[int, dict]:
        """Return {room_id: contract+tenant info} for all active contracts in a property."""
        result = await self.session.execute(text("""
            SELECT c.id, c.room_id, c.agreed_rent, c.start_date, c.end_date, c.num_people,
                   t.full_name AS tenant_name
            FROM contract c
            JOIN tenant t ON t.id = c.tenant_id
            JOIN room r ON r.id = c.room_id
            WHERE r.property_id = :property_id AND c.status = 'active'
        """), {"property_id": property_id})
        return {row["room_id"]: dict(row) for row in result.mappings().all()}

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
