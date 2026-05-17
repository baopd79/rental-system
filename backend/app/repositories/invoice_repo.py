from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from app.models.invoice import Invoice, InvoiceItem


class InvoiceRepo:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_id(self, invoice_id: int) -> Invoice | None:
        return await self.session.get(Invoice, invoice_id)

    async def get_by_contract_period(self, contract_id: int, period: str) -> Invoice | None:
        result = await self.session.exec(
            select(Invoice).where(Invoice.contract_id == contract_id, Invoice.period == period)
        )
        return result.first()

    async def get_by_public_token(self, token: str) -> Invoice | None:
        result = await self.session.exec(select(Invoice).where(Invoice.public_token == token))
        return result.first()

    async def get_all_by_contract(self, contract_id: int) -> list[Invoice]:
        result = await self.session.exec(
            select(Invoice).where(Invoice.contract_id == contract_id)
            .order_by(Invoice.period.desc())  # type: ignore[attr-defined]
        )
        return list(result.all())

    async def get_items(self, invoice_id: int) -> list[InvoiceItem]:
        result = await self.session.exec(
            select(InvoiceItem).where(InvoiceItem.invoice_id == invoice_id)
        )
        return list(result.all())

    async def create(self, invoice: Invoice) -> Invoice:
        self.session.add(invoice)
        await self.session.flush()
        return invoice

    async def create_item(self, item: InvoiceItem) -> InvoiceItem:
        self.session.add(item)
        await self.session.flush()
        return item

    async def update(self, invoice: Invoice) -> Invoice:
        self.session.add(invoice)
        await self.session.flush()
        return invoice

    async def delete(self, invoice: Invoice) -> None:
        items = await self.get_items(invoice.id)
        for item in items:
            await self.session.delete(item)
        await self.session.flush()
        await self.session.delete(invoice)
        await self.session.flush()
