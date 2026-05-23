import calendar
from decimal import Decimal, ROUND_HALF_UP
from datetime import date
from sqlmodel.ext.asyncio.session import AsyncSession
from app.models.invoice import Invoice, InvoiceItem, InvoiceStatus, InvoiceItemType
from app.models.contract import Contract
from app.models.property import Property, WaterCalcType
from app.models.surcharge import SurchargeTemplate, SurchargeCalcType
from app.models.utility import UtilityReading
from app.schemas.invoice import (
    InvoiceGenerateRequest,
    InvoiceRead,
    InvoiceItemRead,
    InvoiceStatusUpdate,
    InvoiceListRead,
    InvoiceDetailRead,
    InvoicePublicRead,
)
from app.schemas.shared_meter import SharedMeterInvoiceDetail
from app.repositories.tenant_repo import TenantRepo
from app.repositories.invoice_repo import InvoiceRepo
from app.repositories.contract_repo import ContractRepo
from app.repositories.room_repo import RoomRepo
from app.repositories.property_repo import PropertyRepo
from app.repositories.surcharge_repo import SurchargeRepo
from app.repositories.utility_repo import UtilityRepo
from app.repositories.shared_meter_repo import SharedMeterRepo
from app.core.exceptions import (
    NotFoundException,
    ForbiddenException,
    BadRequestException,
    ConflictException,
)


def _prorate_factor(start_date: date, end_date: date, period: str) -> Decimal:
    """Days occupied in period / days in period. Returns 1 for full month."""
    year, month = int(period[:4]), int(period[5:7])
    days_in_month = calendar.monthrange(year, month)[1]
    period_start = date(year, month, 1)
    period_end = date(year, month, days_in_month)

    effective_start = max(start_date, period_start)
    effective_end = min(end_date, period_end)

    if effective_end < effective_start:
        return Decimal("0")
    days = (effective_end - effective_start).days + 1
    if days >= days_in_month:
        return Decimal("1")
    return Decimal(str(days)) / Decimal(str(days_in_month))


def _period_overlaps_contract(start_date: date, end_date: date, period: str) -> bool:
    year, month = int(period[:4]), int(period[5:7])
    days_in_month = calendar.monthrange(year, month)[1]
    period_start = date(year, month, 1)
    period_end = date(year, month, days_in_month)
    return start_date <= period_end and end_date >= period_start


VALID_TRANSITIONS = {
    InvoiceStatus.draft: {InvoiceStatus.sent, InvoiceStatus.paid},
    InvoiceStatus.sent: {InvoiceStatus.paid},
    InvoiceStatus.paid: set(),
}


def _round(value: Decimal) -> Decimal:
    return value.quantize(Decimal("1"), rounding=ROUND_HALF_UP)


def _build_items(
    contract: Contract,
    reading: UtilityReading | None,
    surcharges: list[SurchargeTemplate],
    prop: Property,
    effective_elec_rate: Decimal,
    period: str,
) -> list[InvoiceItem]:
    items: list[InvoiceItem] = []
    factor = _prorate_factor(contract.start_date, contract.end_date, period)

    # Prorate label suffix
    year, month = int(period[:4]), int(period[5:7])
    days_in_month = calendar.monthrange(year, month)[1]
    if factor < Decimal("1"):
        eff_start = max(contract.start_date, date(year, month, 1))
        eff_end = min(contract.end_date, date(year, month, days_in_month))
        days_label = (eff_end - eff_start).days + 1
        suffix = f" ({days_label}/{days_in_month} ngày)"
    else:
        suffix = ""

    # Rent (prorated)
    items.append(
        InvoiceItem(
            invoice_id=0,
            item_type=InvoiceItemType.rent,
            name=f"Tiền thuê{suffix}",
            unit_price=contract.agreed_rent,
            quantity=Decimal("1"),
            amount=_round(contract.agreed_rent * factor),
        )
    )

    # Electricity
    if reading is not None and reading.elec_prev is not None:
        usage = reading.elec_curr - reading.elec_prev
        elec_amount = _round(usage * effective_elec_rate)
    else:
        usage = Decimal("0")
        elec_amount = Decimal("0")
    items.append(
        InvoiceItem(
            invoice_id=0,
            item_type=InvoiceItemType.electricity,
            name="Tiền điện",
            unit_price=effective_elec_rate,
            quantity=usage,
            amount=elec_amount,
        )
    )

    # Water
    if prop.water_calc_type == WaterCalcType.per_meter:
        if (
            reading is not None
            and reading.water_prev is not None
            and reading.water_curr is not None
        ):
            water_usage = reading.water_curr - reading.water_prev
            water_amount = _round(water_usage * prop.default_water_rate)
        else:
            water_usage = Decimal("0")
            water_amount = Decimal("0")
        items.append(
            InvoiceItem(
                invoice_id=0,
                item_type=InvoiceItemType.water,
                name="Tiền nước",
                unit_price=prop.default_water_rate,
                quantity=water_usage,
                amount=water_amount,
            )
        )
    elif prop.water_calc_type == WaterCalcType.per_person:
        qty = Decimal(str(contract.num_people))
        items.append(
            InvoiceItem(
                invoice_id=0,
                item_type=InvoiceItemType.water,
                name=f"Tiền nước{suffix}",
                unit_price=prop.default_water_rate,
                quantity=qty,
                amount=_round(prop.default_water_rate * qty * factor),
            )
        )
    else:  # per_room
        items.append(
            InvoiceItem(
                invoice_id=0,
                item_type=InvoiceItemType.water,
                name=f"Tiền nước{suffix}",
                unit_price=prop.default_water_rate,
                quantity=Decimal("1"),
                amount=_round(prop.default_water_rate * factor),
            )
        )

    # Surcharges (prorated for partial months)
    for s in surcharges:
        qty = (
            Decimal(str(contract.num_people))
            if s.calc_type == SurchargeCalcType.per_person
            else Decimal("1")
        )
        items.append(
            InvoiceItem(
                invoice_id=0,
                item_type=InvoiceItemType.surcharge,
                name=f"{s.name}{suffix}",
                unit_price=s.amount,
                quantity=qty,
                amount=_round(s.amount * qty * factor),
            )
        )

    return items


async def _build_shared_elec_items(
    room_id: int,
    num_people: int,
    prop: Property,
    period: str,
    shared_meter_repo: SharedMeterRepo,
    contract_repo: ContractRepo,
) -> list[InvoiceItem]:
    """Calculate proportional shared-meter electricity cost for this room."""
    meters = await shared_meter_repo.get_meters_for_room(room_id)
    items: list[InvoiceItem] = []

    for meter in meters:
        reading = await shared_meter_repo.get_reading(meter.id, period)
        if reading is None or reading.prev_reading is None:
            continue
        total_usage = reading.curr_reading - reading.prev_reading
        if total_usage <= 0:
            continue

        # Sum num_people of rooms with active contracts in this period
        meter_room_ids = await shared_meter_repo.get_room_ids(meter.id)
        people_map: dict[int, int] = {}
        for rid in meter_room_ids:
            active = await contract_repo.get_active_by_room(rid)
            if active and _period_overlaps_contract(
                active.start_date, active.end_date, period
            ):
                people_map[rid] = active.num_people

        total_active_people = sum(people_map.values())
        this_room_people = people_map.get(room_id, 0)
        if total_active_people <= 0 or this_room_people <= 0:
            continue

        proportional_kwh = (
            total_usage
            * Decimal(str(this_room_people))
            / Decimal(str(total_active_people))
        )
        amount = _round(proportional_kwh * prop.default_elec_rate)

        items.append(
            InvoiceItem(
                invoice_id=0,
                item_type=InvoiceItemType.shared_elec,
                name=f"Điện chung: {meter.name}",
                unit_price=prop.default_elec_rate,
                quantity=proportional_kwh.quantize(
                    Decimal("0.01"), rounding=ROUND_HALF_UP
                ),
                amount=amount,
            )
        )

    return items


def _to_read(invoice: Invoice, items: list[InvoiceItem]) -> InvoiceRead:
    return InvoiceRead(
        **invoice.model_dump(),
        items=[InvoiceItemRead.model_validate(i) for i in items],
    )


class InvoiceService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.invoice_repo = InvoiceRepo(session)
        self.contract_repo = ContractRepo(session)
        self.room_repo = RoomRepo(session)
        self.property_repo = PropertyRepo(session)
        self.surcharge_repo = SurchargeRepo(session)
        self.utility_repo = UtilityRepo(session)
        self.shared_meter_repo = SharedMeterRepo(session)
        self.tenant_repo = TenantRepo(session)

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
            result.append(
                InvoiceListRead(
                    **{
                        k: row[k]
                        for k in (
                            "id",
                            "contract_id",
                            "period",
                            "total",
                            "status",
                            "public_token",
                            "payment_reported_at",
                            "room_id",
                            "room_number",
                            "property_name",
                            "tenant_name",
                        )
                    },
                    items=[InvoiceItemRead.model_validate(i) for i in items],
                )
            )
        return result

    async def list_by_room(
        self, room_id: int, clerk_user_id: str
    ) -> list[InvoiceListRead]:
        room = await self.room_repo.get_by_id(room_id)
        if not room:
            raise NotFoundException("Room not found")
        prop = await self.property_repo.get_by_id(room.property_id)
        if not prop or prop.clerk_user_id != clerk_user_id:
            raise ForbiddenException()
        rows = await self.invoice_repo.get_all_by_room(room_id)
        result = []
        for row in rows:
            items = await self.invoice_repo.get_items(row["id"])
            result.append(
                InvoiceListRead(
                    **{
                        k: row[k]
                        for k in (
                            "id",
                            "contract_id",
                            "period",
                            "total",
                            "status",
                            "public_token",
                            "payment_reported_at",
                            "room_id",
                            "room_number",
                            "property_name",
                            "tenant_name",
                        )
                    },
                    items=[InvoiceItemRead.model_validate(i) for i in items],
                )
            )
        return result

    async def list_by_contract(
        self, contract_id: int, clerk_user_id: str
    ) -> list[InvoiceRead]:
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

    async def get_invoice(
        self, invoice_id: int, clerk_user_id: str
    ) -> InvoiceDetailRead:
        invoice, _ = await self._get_invoice_owned(invoice_id, clerk_user_id)
        items = await self.invoice_repo.get_items(invoice.id)
        contract = await self.contract_repo.get_by_id(invoice.contract_id)
        room = await self.room_repo.get_by_id(contract.room_id)
        prop = await self.property_repo.get_by_id(room.property_id)
        tenant = await self.tenant_repo.get_by_id(contract.tenant_id)
        reading = await self.utility_repo.get_by_room_period(room.id, invoice.period)

        # Shared meter readings for meters that include this room
        shared_meter_details: list[SharedMeterInvoiceDetail] = []
        meters = await self.shared_meter_repo.get_meters_for_room(room.id)
        for meter in meters:
            sm_reading = await self.shared_meter_repo.get_reading(
                meter.id, invoice.period
            )
            if sm_reading is None or sm_reading.prev_reading is None:
                continue
            total_usage = sm_reading.curr_reading - sm_reading.prev_reading
            shared_meter_details.append(
                SharedMeterInvoiceDetail(
                    meter_id=meter.id,
                    meter_name=meter.name,
                    prev_reading=sm_reading.prev_reading,
                    curr_reading=sm_reading.curr_reading,
                    total_usage=total_usage,
                )
            )

        return InvoiceDetailRead(
            id=invoice.id,
            contract_id=invoice.contract_id,
            period=invoice.period,
            total=invoice.total,
            status=invoice.status,
            public_token=invoice.public_token,
            payment_reported_at=invoice.payment_reported_at,
            items=[InvoiceItemRead.model_validate(i) for i in items],
            room_id=room.id,
            room_number=room.room_number,
            property_name=prop.name,
            tenant_name=tenant.full_name,
            tenant_phone=tenant.phone,
            elec_prev=reading.elec_prev if reading else None,
            elec_curr=reading.elec_curr if reading else None,
            water_prev=reading.water_prev if reading else None,
            water_curr=reading.water_curr if reading else None,
            shared_meter_readings=shared_meter_details,
        )

    async def generate(
        self, data: InvoiceGenerateRequest, clerk_user_id: str
    ) -> InvoiceRead:
        contract = await self.contract_repo.get_by_id(data.contract_id)
        if not contract:
            raise NotFoundException("Contract not found")

        if not _period_overlaps_contract(
            contract.start_date, contract.end_date, data.period
        ):
            raise BadRequestException(
                f"Period {data.period} is outside contract dates "
                f"({contract.start_date} → {contract.end_date})"
            )

        room = await self.room_repo.get_by_id(contract.room_id)
        prop = await self.property_repo.get_by_id(room.property_id)
        if not prop or prop.clerk_user_id != clerk_user_id:
            raise ForbiddenException()

        if await self.invoice_repo.get_by_contract_period(
            data.contract_id, data.period
        ):
            raise ConflictException(f"Invoice for period {data.period} already exists")

        reading = await self.utility_repo.get_by_room_period(room.id, data.period)
        if reading is None:
            raise BadRequestException(
                f"Phòng {room.room_number}: chưa nhập chỉ số điện cho kỳ {data.period}. "
                "Vui lòng ghi chỉ số trước khi tạo hoá đơn."
            )

        effective_elec_rate = prop.default_elec_rate
        surcharges = await self.surcharge_repo.get_all_by_property(prop.id)

        items = _build_items(
            contract, reading, surcharges, prop, effective_elec_rate, data.period
        )
        shared_items = await _build_shared_elec_items(
            room.id,
            contract.num_people,
            prop,
            data.period,
            self.shared_meter_repo,
            self.contract_repo,
        )
        items.extend(shared_items)
        total = sum(i.amount for i in items)

        invoice = Invoice(
            contract_id=data.contract_id, period=data.period, total=_round(total)
        )
        created = await self.invoice_repo.create(invoice)

        for item in items:
            item.invoice_id = created.id
            await self.invoice_repo.create_item(item)

        await self.session.commit()
        await self.session.refresh(created)
        return await self._load_invoice_read(created)

    async def update_status(
        self, invoice_id: int, data: InvoiceStatusUpdate, clerk_user_id: str
    ) -> InvoiceRead:
        invoice, _ = await self._get_invoice_owned(invoice_id, clerk_user_id)
        allowed = VALID_TRANSITIONS.get(invoice.status, set())
        if data.status not in allowed:
            raise BadRequestException(
                f"Cannot transition from {invoice.status} to {data.status}"
            )
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

    async def get_by_public_token(self, token: str) -> InvoicePublicRead:
        ctx = await self.invoice_repo.get_public_context(token)
        if not ctx:
            raise NotFoundException("Invoice not found")
        invoice = await self.invoice_repo.get_by_public_token(token)
        items = await self.invoice_repo.get_items(invoice.id)
        return InvoicePublicRead(
            **{
                k: ctx[k]
                for k in (
                    "id",
                    "contract_id",
                    "period",
                    "total",
                    "status",
                    "public_token",
                    "room_number",
                    "property_name",
                    "tenant_name",
                    "bank_account_no",
                    "bank_name",
                    "bank_holder",
                )
            },
            payment_reported_at=invoice.payment_reported_at,
            items=[InvoiceItemRead.model_validate(i) for i in items],
        )

    async def report_payment_public(self, token: str) -> InvoicePublicRead:
        """Tenant reports they have transferred — does NOT set status to paid.
        Landlord must verify bank statement and manually confirm via authenticated endpoint.
        """
        from datetime import datetime, timezone

        invoice = await self.invoice_repo.get_by_public_token(token)
        if not invoice:
            raise NotFoundException("Invoice not found")
        if invoice.status != InvoiceStatus.sent:
            raise BadRequestException("Hoá đơn này không ở trạng thái chờ thanh toán.")
        if invoice.payment_reported_at is not None:
            return await self.get_by_public_token(token)
        invoice.payment_reported_at = datetime.now(timezone.utc).replace(tzinfo=None)
        await self.invoice_repo.update(invoice)
        await self.session.commit()
        await self.session.refresh(invoice)
        return await self.get_by_public_token(token)
