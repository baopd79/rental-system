from decimal import Decimal, ROUND_HALF_UP
from fastapi import Depends
from sqlmodel.ext.asyncio.session import AsyncSession
from app.database import get_session
from app.models.invoice import Invoice, InvoiceItem, InvoiceStatus, InvoiceItemType
from app.models.contract import Contract
from app.models.property import Property, WaterCalcType
from app.models.surcharge import SurchargeTemplate, SurchargeCalcType
from app.models.utility import UtilityReading
from app.schemas.invoice import InvoiceGenerateRequest, InvoiceRead, InvoiceItemRead, InvoiceStatusUpdate, InvoiceListRead
from app.repositories.invoice_repo import InvoiceRepo
from app.repositories.contract_repo import ContractRepo
from app.repositories.room_repo import RoomRepo
from app.repositories.property_repo import PropertyRepo
from app.repositories.surcharge_repo import SurchargeRepo
from app.repositories.utility_repo import UtilityRepo
from app.core.exceptions import NotFoundException, ForbiddenException, BadRequestException, ConflictException


VALID_TRANSITIONS = {
    InvoiceStatus.draft: {InvoiceStatus.sent, InvoiceStatus.paid},
    InvoiceStatus.sent:  {InvoiceStatus.paid},
    InvoiceStatus.paid:  set(),
}


def _round(value: Decimal) -> Decimal:
    return value.quantize(Decimal("1"), rounding=ROUND_HALF_UP)


def _build_items(
    contract: Contract,
    reading: UtilityReading | None,
    surcharges: list[SurchargeTemplate],
    prop: Property,
    effective_elec_rate: Decimal,
) -> list[InvoiceItem]:
    items: list[InvoiceItem] = []

    # Rent
    items.append(InvoiceItem(
        invoice_id=0,
        item_type=InvoiceItemType.rent,
        name="Tiền thuê",
        unit_price=contract.agreed_rent,
        quantity=Decimal("1"),
        amount=_round(contract.agreed_rent),
    ))

    # Electricity
    if reading is not None and reading.elec_prev is not None:
        usage = reading.elec_curr - reading.elec_prev
        elec_amount = _round(usage * effective_elec_rate)
    else:
        usage = Decimal("0")
        elec_amount = Decimal("0")
    items.append(InvoiceItem(
        invoice_id=0,
        item_type=InvoiceItemType.electricity,
        name="Tiền điện",
        unit_price=effective_elec_rate,
        quantity=usage,
        amount=elec_amount,
    ))

    # Water
    if prop.water_calc_type == WaterCalcType.per_meter:
        if reading is not None and reading.water_prev is not None and reading.water_curr is not None:
            water_usage = reading.water_curr - reading.water_prev
            water_amount = _round(water_usage * prop.default_water_rate)
        else:
            water_usage = Decimal("0")
            water_amount = Decimal("0")
        items.append(InvoiceItem(
            invoice_id=0,
            item_type=InvoiceItemType.water,
            name="Tiền nước",
            unit_price=prop.default_water_rate,
            quantity=water_usage,
            amount=water_amount,
        ))
    elif prop.water_calc_type == WaterCalcType.per_person:
        qty = Decimal(str(contract.num_people))
        items.append(InvoiceItem(
            invoice_id=0,
            item_type=InvoiceItemType.water,
            name="Tiền nước",
            unit_price=prop.default_water_rate,
            quantity=qty,
            amount=_round(prop.default_water_rate * qty),
        ))
    else:  # per_room
        items.append(InvoiceItem(
            invoice_id=0,
            item_type=InvoiceItemType.water,
            name="Tiền nước",
            unit_price=prop.default_water_rate,
            quantity=Decimal("1"),
            amount=_round(prop.default_water_rate),
        ))

    # Surcharges
    for s in surcharges:
        if s.calc_type == SurchargeCalcType.per_person:
            qty = Decimal(str(contract.num_people))
        else:
            qty = Decimal("1")
        items.append(InvoiceItem(
            invoice_id=0,
            item_type=InvoiceItemType.surcharge,
            name=s.name,
            unit_price=s.amount,
            quantity=qty,
            amount=_round(s.amount * qty),
        ))

    return items


def _to_read(invoice: Invoice, items: list[InvoiceItem]) -> InvoiceRead:
    return InvoiceRead(
        **invoice.model_dump(),
        items=[InvoiceItemRead.model_validate(i) for i in items],
    )


class InvoiceService:
    def __init__(self, session: AsyncSession = Depends(get_session)):
        self.session = session
        self.invoice_repo = InvoiceRepo(session)
        self.contract_repo = ContractRepo(session)
        self.room_repo = RoomRepo(session)
        self.property_repo = PropertyRepo(session)
        self.surcharge_repo = SurchargeRepo(session)
        self.utility_repo = UtilityRepo(session)

    async def _get_invoice_owned(self, invoice_id: int, clerk_user_id: str):
        invoice = await self.invoice_repo.get_by_id(invoice_id)
        if not invoice:
            raise NotFoundException("Invoice not found")
        contract = await self.contract_repo.get_by_id(invoice.contract_id)
        room = await self.room_repo.get_by_id(contract.room_id)
        prop = await self.property_repo.get_by_id(room.property_id)
        if not prop or prop.clerk_user_id != clerk_user_id:
            raise ForbiddenException()
        return invoice, prop

    async def _load_invoice_read(self, invoice: Invoice) -> InvoiceRead:
        items = await self.invoice_repo.get_items(invoice.id)
        return _to_read(invoice, items)

    async def list_all(self, clerk_user_id: str) -> list[InvoiceListRead]:
        rows = await self.invoice_repo.get_all_by_user(clerk_user_id)
        result = []
        for row in rows:
            items = await self.invoice_repo.get_items(row["id"])
            result.append(InvoiceListRead(
                **{k: row[k] for k in ("id", "contract_id", "period", "total", "status", "public_token",
                                       "room_id", "room_number", "property_name", "tenant_name")},
                items=[InvoiceItemRead.model_validate(i) for i in items],
            ))
        return result

    async def list_by_contract(self, contract_id: int, clerk_user_id: str) -> list[InvoiceRead]:
        contract = await self.contract_repo.get_by_id(contract_id)
        if not contract:
            raise NotFoundException("Contract not found")
        room = await self.room_repo.get_by_id(contract.room_id)
        prop = await self.property_repo.get_by_id(room.property_id)
        if not prop or prop.clerk_user_id != clerk_user_id:
            raise ForbiddenException()
        invoices = await self.invoice_repo.get_all_by_contract(contract_id)
        result = []
        for inv in invoices:
            result.append(await self._load_invoice_read(inv))
        return result

    async def get_invoice(self, invoice_id: int, clerk_user_id: str) -> InvoiceRead:
        invoice, _ = await self._get_invoice_owned(invoice_id, clerk_user_id)
        return await self._load_invoice_read(invoice)

    async def generate(self, data: InvoiceGenerateRequest, clerk_user_id: str) -> InvoiceRead:
        contract = await self.contract_repo.get_by_id(data.contract_id)
        if not contract:
            raise NotFoundException("Contract not found")

        room = await self.room_repo.get_by_id(contract.room_id)
        prop = await self.property_repo.get_by_id(room.property_id)
        if not prop or prop.clerk_user_id != clerk_user_id:
            raise ForbiddenException()

        if await self.invoice_repo.get_by_contract_period(data.contract_id, data.period):
            raise ConflictException(f"Invoice for period {data.period} already exists")

        effective_elec_rate = room.elec_rate if room.elec_rate is not None else prop.default_elec_rate
        reading = await self.utility_repo.get_by_room_period(room.id, data.period)
        surcharges = await self.surcharge_repo.get_all_by_property(prop.id)

        items = _build_items(contract, reading, surcharges, prop, effective_elec_rate)
        total = sum(i.amount for i in items)

        invoice = Invoice(contract_id=data.contract_id, period=data.period, total=_round(total))
        created = await self.invoice_repo.create(invoice)

        for item in items:
            item.invoice_id = created.id
            await self.invoice_repo.create_item(item)

        await self.session.commit()
        await self.session.refresh(created)
        return await self._load_invoice_read(created)

    async def update_status(self, invoice_id: int, data: InvoiceStatusUpdate, clerk_user_id: str) -> InvoiceRead:
        invoice, _ = await self._get_invoice_owned(invoice_id, clerk_user_id)
        allowed = VALID_TRANSITIONS.get(invoice.status, set())
        if data.status not in allowed:
            raise BadRequestException(f"Cannot transition from {invoice.status} to {data.status}")
        invoice.status = data.status
        await self.invoice_repo.update(invoice)
        await self.session.commit()
        await self.session.refresh(invoice)
        return await self._load_invoice_read(invoice)

    async def delete_invoice(self, invoice_id: int, clerk_user_id: str) -> None:
        invoice, _ = await self._get_invoice_owned(invoice_id, clerk_user_id)
        if invoice.status != InvoiceStatus.draft:
            raise BadRequestException("Only draft invoices can be deleted")
        await self.invoice_repo.delete(invoice)
        await self.session.commit()

    async def get_by_public_token(self, token: str) -> InvoiceRead:
        invoice = await self.invoice_repo.get_by_public_token(token)
        if not invoice:
            raise NotFoundException("Invoice not found")
        return await self._load_invoice_read(invoice)
