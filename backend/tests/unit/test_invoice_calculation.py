from decimal import Decimal
from app.models.contract import Contract, ContractStatus
from app.models.property import Property, WaterCalcType
from app.models.surcharge import SurchargeTemplate, SurchargeCalcType
from app.models.utility import UtilityReading
from app.models.invoice import InvoiceItemType
from app.services.invoice_service import _build_items, _prorate_factor
from datetime import date


def make_contract(agreed_rent: str = "3000000", num_people: int = 2) -> Contract:
    return Contract(
        id=1, room_id=1, tenant_id=1,
        start_date=date(2026, 1, 1), end_date=date(2026, 12, 31),
        agreed_rent=Decimal(agreed_rent),
        deposit=Decimal("0"),
        num_people=num_people,
        status=ContractStatus.active,
    )


def make_property(water_calc_type: WaterCalcType = WaterCalcType.per_meter,
                  elec_rate: str = "3500", water_rate: str = "15000") -> Property:
    return Property(
        id=1, clerk_user_id="u1", name="Test", address="Test",
        default_elec_rate=Decimal(elec_rate),
        default_water_rate=Decimal(water_rate),
        water_calc_type=water_calc_type,
    )


def make_reading(elec_prev: str | None, elec_curr: str,
                 water_prev: str | None = None, water_curr: str | None = None) -> UtilityReading:
    return UtilityReading(
        id=1, room_id=1, period="2026-05",
        elec_prev=Decimal(elec_prev) if elec_prev else None,
        elec_curr=Decimal(elec_curr),
        water_prev=Decimal(water_prev) if water_prev else None,
        water_curr=Decimal(water_curr) if water_curr else None,
        is_prev_auto=True,
    )


def items_by_type(items, t):
    return [i for i in items if i.item_type == t]


# --- Rent ---

def test_rent_item_uses_agreed_rent():
    contract = make_contract(agreed_rent="3500000")
    prop = make_property()
    items = _build_items(contract, None, [], prop, prop.default_elec_rate, "2026-05")
    rent = items_by_type(items, InvoiceItemType.rent)
    assert len(rent) == 1
    assert rent[0].amount == Decimal("3500000")


# --- Electricity ---

def test_elec_normal():
    contract = make_contract()
    prop = make_property()
    reading = make_reading("1000", "1120")
    items = _build_items(contract, reading, [], prop, prop.default_elec_rate, "2026-05")
    elec = items_by_type(items, InvoiceItemType.electricity)[0]
    assert elec.quantity == Decimal("120")
    assert elec.amount == Decimal("420000")   # 120 × 3500


def test_elec_first_reading_prev_null_is_zero():
    contract = make_contract()
    prop = make_property()
    reading = make_reading(None, "1000")
    items = _build_items(contract, reading, [], prop, prop.default_elec_rate, "2026-05")
    elec = items_by_type(items, InvoiceItemType.electricity)[0]
    assert elec.amount == Decimal("0")


def test_elec_no_reading_is_zero():
    contract = make_contract()
    prop = make_property()
    items = _build_items(contract, None, [], prop, prop.default_elec_rate, "2026-05")
    elec = items_by_type(items, InvoiceItemType.electricity)[0]
    assert elec.amount == Decimal("0")


def test_elec_uses_effective_rate():
    contract = make_contract()
    prop = make_property(elec_rate="3500")
    reading = make_reading("500", "600")
    # room has override rate 4000
    items = _build_items(contract, reading, [], prop, Decimal("4000"), "2026-05")
    elec = items_by_type(items, InvoiceItemType.electricity)[0]
    assert elec.amount == Decimal("400000")   # 100 × 4000


# --- Water ---

def test_water_per_meter():
    contract = make_contract()
    prop = make_property(water_calc_type=WaterCalcType.per_meter, water_rate="15000")
    reading = make_reading("1000", "1100", water_prev="40", water_curr="55")
    items = _build_items(contract, reading, [], prop, prop.default_elec_rate, "2026-05")
    water = items_by_type(items, InvoiceItemType.water)[0]
    assert water.quantity == Decimal("15")
    assert water.amount == Decimal("225000")   # 15 × 15000


def test_water_per_meter_no_reading_is_zero():
    contract = make_contract()
    prop = make_property(water_calc_type=WaterCalcType.per_meter, water_rate="15000")
    items = _build_items(contract, None, [], prop, prop.default_elec_rate, "2026-05")
    water = items_by_type(items, InvoiceItemType.water)[0]
    assert water.amount == Decimal("0")


def test_water_per_person():
    contract = make_contract(num_people=3)
    prop = make_property(water_calc_type=WaterCalcType.per_person, water_rate="50000")
    items = _build_items(contract, None, [], prop, prop.default_elec_rate, "2026-05")
    water = items_by_type(items, InvoiceItemType.water)[0]
    assert water.quantity == Decimal("3")
    assert water.amount == Decimal("150000")   # 3 × 50000


def test_water_per_room():
    contract = make_contract(num_people=5)
    prop = make_property(water_calc_type=WaterCalcType.per_room, water_rate="80000")
    items = _build_items(contract, None, [], prop, prop.default_elec_rate, "2026-05")
    water = items_by_type(items, InvoiceItemType.water)[0]
    assert water.quantity == Decimal("1")
    assert water.amount == Decimal("80000")    # flat


# --- Surcharges ---

def test_surcharge_per_room():
    contract = make_contract(num_people=3)
    prop = make_property()
    surcharges = [SurchargeTemplate(id=1, property_id=1, name="Phí wifi",
                                    calc_type=SurchargeCalcType.per_room, amount=Decimal("100000"))]
    items = _build_items(contract, None, surcharges, prop, prop.default_elec_rate, "2026-05")
    sc = items_by_type(items, InvoiceItemType.surcharge)
    assert len(sc) == 1
    assert sc[0].name == "Phí wifi"
    assert sc[0].amount == Decimal("100000")


def test_surcharge_per_person():
    contract = make_contract(num_people=2)
    prop = make_property()
    surcharges = [SurchargeTemplate(id=1, property_id=1, name="Phí vệ sinh",
                                    calc_type=SurchargeCalcType.per_person, amount=Decimal("20000"))]
    items = _build_items(contract, None, surcharges, prop, prop.default_elec_rate, "2026-05")
    sc = items_by_type(items, InvoiceItemType.surcharge)[0]
    assert sc.quantity == Decimal("2")
    assert sc.amount == Decimal("40000")


def test_multiple_surcharges_each_become_item():
    contract = make_contract()
    prop = make_property()
    surcharges = [
        SurchargeTemplate(id=1, property_id=1, name="Phí wifi", calc_type=SurchargeCalcType.per_room, amount=Decimal("100000")),
        SurchargeTemplate(id=2, property_id=1, name="Phí rác",  calc_type=SurchargeCalcType.per_room, amount=Decimal("20000")),
    ]
    items = _build_items(contract, None, surcharges, prop, prop.default_elec_rate, "2026-05")
    sc = items_by_type(items, InvoiceItemType.surcharge)
    assert len(sc) == 2


# --- Total ---

def test_total_sum():
    contract = make_contract(agreed_rent="3000000", num_people=2)
    prop = make_property(water_calc_type=WaterCalcType.per_person, water_rate="50000")
    reading = make_reading("1000", "1100")
    surcharges = [SurchargeTemplate(id=1, property_id=1, name="Wifi",
                                    calc_type=SurchargeCalcType.per_room, amount=Decimal("100000"))]
    items = _build_items(contract, reading, surcharges, prop, prop.default_elec_rate, "2026-05")
    total = sum(i.amount for i in items)
    # rent=3000000, elec=100*3500=350000, water=2*50000=100000, surcharge=100000
    assert total == Decimal("3550000")


# ── Proration ──────────────────────────────────────────────────────────────────

def test_prorate_factor_full_month():
    assert _prorate_factor(date(2026, 1, 1), date(2026, 12, 31), "2026-05") == Decimal("1")


def test_prorate_factor_move_in_mid_month():
    # Move in May 16, contract ends Dec 31 → 16 days in May (16/31)
    factor = _prorate_factor(date(2026, 5, 16), date(2026, 12, 31), "2026-05")
    assert factor == Decimal("16") / Decimal("31")


def test_prorate_factor_move_out_mid_month():
    # Full contract, ends May 15 → 15/31
    factor = _prorate_factor(date(2026, 1, 1), date(2026, 5, 15), "2026-05")
    assert factor == Decimal("15") / Decimal("31")


def test_prorate_factor_zero_overlap():
    # Contract already ended in April — no days in May
    factor = _prorate_factor(date(2026, 1, 1), date(2026, 4, 30), "2026-05")
    assert factor == Decimal("0")


def test_prorate_factor_single_day():
    factor = _prorate_factor(date(2026, 5, 31), date(2026, 12, 31), "2026-05")
    assert factor == Decimal("1") / Decimal("31")


def make_partial_contract(start: date, end: date, agreed_rent: str = "3000000", num_people: int = 2) -> Contract:
    return Contract(
        id=1, room_id=1, tenant_id=1,
        start_date=start, end_date=end,
        agreed_rent=Decimal(agreed_rent),
        deposit=Decimal("0"),
        num_people=num_people,
        status=ContractStatus.active,
    )


def test_rent_prorated_for_partial_month():
    # Move in May 16 → 16/31 days
    contract = make_partial_contract(date(2026, 5, 16), date(2026, 12, 31), agreed_rent="3100000")
    prop = make_property()
    items = _build_items(contract, None, [], prop, prop.default_elec_rate, "2026-05")
    rent = items_by_type(items, InvoiceItemType.rent)[0]
    expected = round(Decimal("3100000") * Decimal("16") / Decimal("31"))
    assert rent.amount == expected


def test_electricity_not_prorated():
    # Even for partial month, electricity uses actual usage (no proration)
    contract = make_partial_contract(date(2026, 5, 16), date(2026, 12, 31))
    prop = make_property(elec_rate="3500")
    reading = make_reading("1000", "1050")
    items = _build_items(contract, reading, [], prop, prop.default_elec_rate, "2026-05")
    elec = items_by_type(items, InvoiceItemType.electricity)[0]
    assert elec.amount == Decimal("175000")   # 50 × 3500, no proration


def test_surcharge_per_room_prorated():
    contract = make_partial_contract(date(2026, 5, 16), date(2026, 12, 31))
    prop = make_property()
    surcharges = [SurchargeTemplate(id=1, property_id=1, name="Wifi",
                                    calc_type=SurchargeCalcType.per_room, amount=Decimal("310000"))]
    items = _build_items(contract, None, surcharges, prop, prop.default_elec_rate, "2026-05")
    sc = items_by_type(items, InvoiceItemType.surcharge)[0]
    expected = round(Decimal("310000") * Decimal("16") / Decimal("31"))
    assert sc.amount == expected


def test_water_per_meter_not_prorated():
    # Water per_meter uses actual consumption — not prorated
    contract = make_partial_contract(date(2026, 5, 16), date(2026, 12, 31))
    prop = make_property(water_calc_type=WaterCalcType.per_meter, water_rate="15000")
    reading = make_reading("1000", "1010", water_prev="40", water_curr="43")
    items = _build_items(contract, reading, [], prop, prop.default_elec_rate, "2026-05")
    water = items_by_type(items, InvoiceItemType.water)[0]
    assert water.amount == Decimal("45000")   # 3 m³ × 15000, no proration


def test_water_per_person_prorated():
    contract = make_partial_contract(date(2026, 5, 16), date(2026, 12, 31), num_people=2)
    prop = make_property(water_calc_type=WaterCalcType.per_person, water_rate="310000")
    items = _build_items(contract, None, [], prop, prop.default_elec_rate, "2026-05")
    water = items_by_type(items, InvoiceItemType.water)[0]
    expected = round(Decimal("310000") * 2 * Decimal("16") / Decimal("31"))
    assert water.amount == expected
