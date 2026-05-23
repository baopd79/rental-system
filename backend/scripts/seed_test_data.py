"""
Seed test data: 2 properties × 5 rooms × 1 contract each.

Usage:
    uv run python scripts/seed_test_data.py --user-id <your_clerk_user_id>

How to find your clerk_user_id:
    1. Log in to the app at http://localhost:3000
    2. Open browser devtools → Network tab
    3. Click any API request to localhost:8000
    4. Copy the Authorization header value (Bearer <token>)
    5. Decode at https://jwt.io → "sub" field is your user_id
    OR: go to https://dashboard.clerk.com → Users → click your user → copy User ID
"""

import asyncio
import argparse
import sys
from decimal import Decimal
from datetime import date

sys.path.insert(0, ".")

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.models.property import Property, WaterCalcType
from app.models.room import Room, RoomStatus
from app.models.tenant import Tenant
from app.models.contract import Contract, ContractStatus
from app.models.surcharge import SurchargeTemplate, SurchargeCalcType
import app.models  # noqa — register all models


PROPERTIES = [
    {
        "name": "Nhà trọ Quận 1",
        "address": "123 Lê Lợi, Phường Bến Nghé, Quận 1, TP.HCM",
        "default_elec_rate": Decimal("3500"),
        "default_water_rate": Decimal("15000"),
        "water_calc_type": WaterCalcType.per_meter,
        "surcharges": [
            {
                "name": "Phí wifi",
                "calc_type": SurchargeCalcType.per_room,
                "amount": Decimal("100000"),
            },
            {
                "name": "Phí vệ sinh",
                "calc_type": SurchargeCalcType.per_person,
                "amount": Decimal("20000"),
            },
        ],
        "rooms": [
            {
                "room_number": "101",
                "floor": 1,
                "area_m2": Decimal("22"),
                "rent_price": Decimal("3500000"),
                "deposit": Decimal("7000000"),
            },
            {
                "room_number": "102",
                "floor": 1,
                "area_m2": Decimal("18"),
                "rent_price": Decimal("3000000"),
                "deposit": Decimal("6000000"),
            },
            {
                "room_number": "201",
                "floor": 2,
                "area_m2": Decimal("25"),
                "rent_price": Decimal("4000000"),
                "deposit": Decimal("8000000"),
                "elec_rate": Decimal("4000"),
            },
            {
                "room_number": "202",
                "floor": 2,
                "area_m2": Decimal("20"),
                "rent_price": Decimal("3500000"),
                "deposit": Decimal("7000000"),
            },
            {
                "room_number": "301",
                "floor": 3,
                "area_m2": Decimal("30"),
                "rent_price": Decimal("5000000"),
                "deposit": Decimal("10000000"),
            },
        ],
    },
    {
        "name": "Nhà trọ Bình Thạnh",
        "address": "45 Xô Viết Nghệ Tĩnh, Phường 17, Bình Thạnh, TP.HCM",
        "default_elec_rate": Decimal("3500"),
        "default_water_rate": Decimal("50000"),
        "water_calc_type": WaterCalcType.per_person,
        "surcharges": [
            {
                "name": "Phí rác",
                "calc_type": SurchargeCalcType.per_room,
                "amount": Decimal("30000"),
            },
        ],
        "rooms": [
            {
                "room_number": "A1",
                "floor": 1,
                "area_m2": Decimal("20"),
                "rent_price": Decimal("2800000"),
                "deposit": Decimal("5600000"),
            },
            {
                "room_number": "A2",
                "floor": 1,
                "area_m2": Decimal("20"),
                "rent_price": Decimal("2800000"),
                "deposit": Decimal("5600000"),
            },
            {
                "room_number": "B1",
                "floor": 2,
                "area_m2": Decimal("22"),
                "rent_price": Decimal("3200000"),
                "deposit": Decimal("6400000"),
            },
            {
                "room_number": "B2",
                "floor": 2,
                "area_m2": Decimal("22"),
                "rent_price": Decimal("3200000"),
                "deposit": Decimal("6400000"),
            },
            {
                "room_number": "C1",
                "floor": 3,
                "area_m2": Decimal("28"),
                "rent_price": Decimal("3800000"),
                "deposit": Decimal("7600000"),
            },
        ],
    },
]

TENANTS = [
    {"full_name": "Nguyễn Văn An", "phone": "0901234567", "cccd": "079201012345"},
    {"full_name": "Trần Thị Bảo", "phone": "0912345678", "cccd": "079202023456"},
    {"full_name": "Lê Minh Châu", "phone": "0923456789", "cccd": "079203034567"},
    {"full_name": "Phạm Thị Dung", "phone": "0934567890", "cccd": "079204045678"},
    {"full_name": "Hoàng Văn Em", "phone": "0945678901", "cccd": "079205056789"},
    {"full_name": "Vũ Thị Phương", "phone": "0956789012", "cccd": "079206067890"},
    {"full_name": "Đặng Minh Giang", "phone": "0967890123", "cccd": "079207078901"},
    {"full_name": "Bùi Thị Hoa", "phone": "0978901234", "cccd": "079208089012"},
    {"full_name": "Ngô Văn Khanh", "phone": "0989012345", "cccd": "079209090123"},
    {"full_name": "Đỗ Thị Lan", "phone": "0990123456", "cccd": "079210001234"},
]


async def seed(clerk_user_id: str) -> None:
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        tenant_idx = 0

        for prop_data in PROPERTIES:
            surcharges_data = prop_data.pop("surcharges")
            rooms_data = prop_data.pop("rooms")

            prop = Property(**prop_data, clerk_user_id=clerk_user_id)
            session.add(prop)
            await session.flush()
            print(f"  ✓ Property: {prop.name} (id={prop.id})")

            for s in surcharges_data:
                session.add(SurchargeTemplate(**s, property_id=prop.id))
            await session.flush()

            for room_data in rooms_data:
                room = Room(
                    **room_data, property_id=prop.id, status=RoomStatus.occupied
                )
                session.add(room)
                await session.flush()

                tenant_data = TENANTS[tenant_idx % len(TENANTS)]
                tenant = Tenant(**tenant_data, clerk_user_id=clerk_user_id)
                session.add(tenant)
                await session.flush()

                contract = Contract(
                    room_id=room.id,
                    tenant_id=tenant.id,
                    start_date=date(2026, 1, 1),
                    end_date=date(2026, 12, 31),
                    agreed_rent=room.rent_price,
                    deposit=room.deposit,
                    num_people=2,
                    status=ContractStatus.active,
                )
                session.add(contract)
                await session.flush()

                print(f"      P.{room.room_number} → {tenant.full_name}")
                tenant_idx += 1

        await session.commit()
        print(
            f"\n✅ Seeded 2 properties × 5 rooms × 5 contracts for user: {clerk_user_id}"
        )

    await engine.dispose()


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed test data for VnRental")
    parser.add_argument(
        "--user-id", required=True, help="Clerk user_id (e.g. user_2abc...)"
    )
    args = parser.parse_args()

    print(f"\n🌱 Seeding test data for user: {args.user_id}\n")
    asyncio.run(seed(args.user_id))


if __name__ == "__main__":
    main()
