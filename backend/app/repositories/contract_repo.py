from sqlmodel import select, func
from sqlmodel.ext.asyncio.session import AsyncSession
from app.models.contract import Contract, ContractStatus


async def get_active_by_room(session: AsyncSession, room_id: int) -> Contract | None:
    result = await session.exec(
        select(Contract).where(Contract.room_id == room_id, Contract.status == ContractStatus.active)
    )
    return result.first()


async def get_all_by_room(session: AsyncSession, room_id: int) -> list[Contract]:
    result = await session.exec(select(Contract).where(Contract.room_id == room_id))
    return list(result.all())


async def count_by_room(session: AsyncSession, room_id: int) -> int:
    result = await session.exec(select(func.count()).where(Contract.room_id == room_id))
    return result.one()


async def get_by_id(session: AsyncSession, contract_id: int) -> Contract | None:
    return await session.get(Contract, contract_id)


async def create(session: AsyncSession, contract: Contract) -> Contract:
    session.add(contract)
    return contract


async def update(session: AsyncSession, contract: Contract) -> Contract:
    session.add(contract)
    return contract
