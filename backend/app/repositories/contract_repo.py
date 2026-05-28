from sqlmodel import select, func
from sqlalchemy import text
from sqlmodel.ext.asyncio.session import AsyncSession
from app.models.contract import Contract, ContractStatus


class ContractRepo:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_active_by_property(self, property_id: int) -> dict[int, dict]:
        """Return {room_id: contract+tenant info} for all active contracts in a property."""
        result = await self.session.exec(
            text("""
            SELECT c.id, c.room_id, c.agreed_rent, c.start_date, c.end_date, c.num_people,
                   t.full_name AS tenant_name
            FROM contract c
            JOIN tenant t ON t.id = c.tenant_id
            JOIN room r ON r.id = c.room_id
            WHERE r.property_id = :property_id AND c.status = 'active'
        """),
            params={"property_id": property_id},
        )
        return {row["room_id"]: dict(row) for row in result.mappings().all()}

    async def get_active_by_room(self, room_id: int) -> Contract | None:
        result = await self.session.exec(
            select(Contract).where(
                Contract.room_id == room_id, Contract.status == ContractStatus.active
            )
        )
        return result.first()

    async def get_all_by_room_with_tenant(self, room_id: int) -> list[dict]:
        result = await self.session.exec(
            text("""
            SELECT c.id, c.room_id, c.tenant_id, c.start_date, c.end_date,
                   c.agreed_rent, c.deposit, c.num_people, c.status,
                   t.id AS t_id, t.full_name, t.cccd, t.phone, t.email, t.date_of_birth
            FROM contract c
            JOIN tenant t ON t.id = c.tenant_id
            WHERE c.room_id = :room_id
            ORDER BY c.start_date DESC
        """),
            params={"room_id": room_id},
        )
        return [dict(row) for row in result.mappings().all()]

    async def get_all_by_room(self, room_id: int) -> list[Contract]:
        result = await self.session.exec(
            select(Contract)
            .where(Contract.room_id == room_id)
            .order_by(Contract.start_date.desc())  # type: ignore[attr-defined]
        )
        return list(result.all())

    async def count_by_room(self, room_id: int) -> int:
        result = await self.session.exec(
            select(func.count(Contract.id)).where(Contract.room_id == room_id)
        )
        return result.one()

    async def get_by_id(self, contract_id: int) -> Contract | None:
        return await self.session.get(Contract, contract_id)

    async def create(self, contract: Contract) -> Contract:
        self.session.add(contract)
        await self.session.flush()
        return contract

    async def get_all_by_user(self, clerk_user_id: str) -> list[dict]:
        result = await self.session.exec(
            text("""
            SELECT c.id, c.status, c.start_date, c.end_date,
                   c.agreed_rent, c.deposit, c.num_people,
                   c.tenant_id, t.full_name AS tenant_name, t.phone AS tenant_phone,
                   c.room_id, r.room_number, r.property_id, p.name AS property_name
            FROM contract c
            JOIN tenant t ON t.id = c.tenant_id
            JOIN room r ON r.id = c.room_id
            JOIN property p ON p.id = r.property_id
            WHERE p.clerk_user_id = :clerk_user_id
            ORDER BY c.start_date DESC
        """),
            params={"clerk_user_id": clerk_user_id},
        )
        return [dict(row) for row in result.mappings().all()]

    async def get_all_by_tenant(self, tenant_id: int) -> list[dict]:
        result = await self.session.exec(
            text("""
            SELECT c.id, c.room_id, c.tenant_id, c.start_date, c.end_date,
                   c.agreed_rent, c.deposit, c.num_people, c.status,
                   r.room_number, p.name AS property_name, p.id AS property_id
            FROM contract c
            JOIN room r ON r.id = c.room_id
            JOIN property p ON p.id = r.property_id
            WHERE c.tenant_id = :tenant_id
            ORDER BY c.start_date DESC
        """),
            params={"tenant_id": tenant_id},
        )
        return [dict(row) for row in result.mappings().all()]

    async def update(self, contract: Contract) -> Contract:
        await self.session.flush()
        return contract
