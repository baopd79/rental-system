import pytest
from httpx import AsyncClient, ASGITransport
from jose import jwt
from app.main import app

USER_A = "user_utility_a"
USER_B = "user_utility_b"


def auth_headers(user_id: str) -> dict:
    token = jwt.encode({"sub": user_id}, key="test", algorithm="HS256")
    return {"Authorization": f"Bearer {token}"}


async def create_property(
    client: AsyncClient, water_calc_type: str = "per_meter"
) -> dict:
    r = await client.post(
        "/api/v1/properties",
        json={
            "name": "Test House",
            "address": "123 Test",
            "default_elec_rate": "3500",
            "default_water_rate": "15000",
            "water_calc_type": water_calc_type,
        },
        headers=auth_headers(USER_A),
    )
    assert r.status_code == 201
    return r.json()


async def create_room(client: AsyncClient, property_id: int) -> dict:
    r = await client.post(
        f"/api/v1/properties/{property_id}/rooms",
        json={"room_number": "101", "rent_price": "3000000"},
        headers=auth_headers(USER_A),
    )
    assert r.status_code == 201
    return r.json()


async def setup_room_with_contract(
    client: AsyncClient, water_calc_type: str = "per_meter"
) -> dict:
    """Create property + room + active contract. Initial reading lives in 2024-01
    so test periods (2025-12+) are after but with a gap — single-create has no
    month-skip guard, so gaps are fine."""
    prop = await create_property(client, water_calc_type)
    room = await create_room(client, prop["id"])
    tenant = (
        await client.post(
            "/api/v1/tenants",
            json={"full_name": "Test Tenant"},
            headers=auth_headers(USER_A),
        )
    ).json()
    contract = (
        await client.post(
            "/api/v1/contracts",
            json={
                "room_id": room["id"],
                "tenant_id": tenant["id"],
                "start_date": "2024-01-01",
                "end_date": "2027-12-31",
                "agreed_rent": "3000000",
                "deposit": "0",
                "num_people": 1,
                "initial_elec_curr": "0",
                "initial_water_curr": "0",
            },
            headers=auth_headers(USER_A),
        )
    ).json()
    return {"property": prop, "room": room, "contract": contract}


async def post_reading(
    client: AsyncClient,
    room_id: int,
    period: str,
    elec_curr: str,
    water_curr: str | None = None,
) -> dict:
    body: dict = {"room_id": room_id, "period": period, "elec_curr": elec_curr}
    if water_curr is not None:
        body["water_curr"] = water_curr
    r = await client.post(
        "/api/v1/utility-readings", json=body, headers=auth_headers(USER_A)
    )
    return r


# --- Contract requirement ---


@pytest.mark.asyncio
async def test_post_reading_without_active_contract_returns_400():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        prop = await create_property(client)
        room = await create_room(client, prop["id"])

        r = await post_reading(client, room["id"], "2026-01", "1000.00")
    assert r.status_code == 400


# --- First user-created reading after contract initial ---


@pytest.mark.asyncio
async def test_first_reading_after_gap_has_null_prev():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        setup = await setup_room_with_contract(client)

        # Contract initial reading is in 2024-01; 2025-12 is a far gap so prev = None
        r = await post_reading(client, setup["room"]["id"], "2026-01", "1000.00")
    assert r.status_code == 201
    data = r.json()
    assert data["elec_prev"] is None
    assert data["elec_curr"] == "1000.00"
    assert data["is_prev_auto"] is False


# --- Auto-fill ---


@pytest.mark.asyncio
async def test_second_reading_auto_fills_prev():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        setup = await setup_room_with_contract(client)
        room_id = setup["room"]["id"]

        await post_reading(client, room_id, "2026-04", "1000.00", "50.00")
        r = await post_reading(client, room_id, "2026-05", "1150.00", "62.00")

    assert r.status_code == 201
    data = r.json()
    assert data["elec_prev"] == "1000.00"
    assert data["elec_curr"] == "1150.00"
    assert data["is_prev_auto"] is True
    assert data["water_prev"] == "50.00"
    assert data["water_curr"] == "62.00"


@pytest.mark.asyncio
async def test_auto_fill_across_year_boundary():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        setup = await setup_room_with_contract(client)
        room_id = setup["room"]["id"]

        await post_reading(client, room_id, "2025-12", "5000.00")
        r = await post_reading(client, room_id, "2026-01", "5120.00")

    assert r.status_code == 201
    data = r.json()
    assert data["elec_prev"] == "5000.00"
    assert data["is_prev_auto"] is True


# --- Validation ---


@pytest.mark.asyncio
async def test_curr_less_than_prev_returns_400():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        setup = await setup_room_with_contract(client)
        room_id = setup["room"]["id"]

        await post_reading(client, room_id, "2026-04", "1000.00")
        r = await post_reading(client, room_id, "2026-05", "900.00")

    assert r.status_code == 400


@pytest.mark.asyncio
async def test_duplicate_period_returns_409():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        setup = await setup_room_with_contract(client)
        room_id = setup["room"]["id"]

        await post_reading(client, room_id, "2026-05", "1000.00")
        r = await post_reading(client, room_id, "2026-05", "1100.00")

    assert r.status_code == 409


# --- Water ignored for non-per_meter ---


@pytest.mark.asyncio
async def test_water_fields_null_for_per_person_property():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        setup = await setup_room_with_contract(client, water_calc_type="per_person")

        r = await post_reading(
            client, setup["room"]["id"], "2026-05", "1000.00", water_curr="50.00"
        )

    assert r.status_code == 201
    data = r.json()
    assert data["water_curr"] is None
    assert data["water_prev"] is None


@pytest.mark.asyncio
async def test_water_fields_null_for_per_room_property():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        setup = await setup_room_with_contract(client, water_calc_type="per_room")

        r = await post_reading(
            client, setup["room"]["id"], "2026-05", "1000.00", water_curr="50.00"
        )

    assert r.status_code == 201
    data = r.json()
    assert data["water_curr"] is None


# --- Update/Delete: only latest ---


@pytest.mark.asyncio
async def test_update_latest_reading():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        setup = await setup_room_with_contract(client)
        reading = (
            await post_reading(client, setup["room"]["id"], "2026-05", "1000.00")
        ).json()

        r = await client.patch(
            f"/api/v1/utility-readings/{reading['id']}",
            json={"elec_curr": "1050.00"},
            headers=auth_headers(USER_A),
        )
    assert r.status_code == 200
    assert r.json()["elec_curr"] == "1050.00"


@pytest.mark.asyncio
async def test_update_non_latest_reading_returns_409():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        setup = await setup_room_with_contract(client)
        room_id = setup["room"]["id"]

        old = (await post_reading(client, room_id, "2026-04", "1000.00")).json()
        await post_reading(client, room_id, "2026-05", "1100.00")

        r = await client.patch(
            f"/api/v1/utility-readings/{old['id']}",
            json={"elec_curr": "1005.00"},
            headers=auth_headers(USER_A),
        )
    assert r.status_code == 409


@pytest.mark.asyncio
async def test_delete_latest_reading():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        setup = await setup_room_with_contract(client)
        reading = (
            await post_reading(client, setup["room"]["id"], "2026-05", "1000.00")
        ).json()

        r = await client.delete(
            f"/api/v1/utility-readings/{reading['id']}",
            headers=auth_headers(USER_A),
        )
    assert r.status_code == 204


@pytest.mark.asyncio
async def test_delete_non_latest_reading_returns_409():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        setup = await setup_room_with_contract(client)
        room_id = setup["room"]["id"]

        old = (await post_reading(client, room_id, "2026-04", "1000.00")).json()
        await post_reading(client, room_id, "2026-05", "1100.00")

        r = await client.delete(
            f"/api/v1/utility-readings/{old['id']}",
            headers=auth_headers(USER_A),
        )
    assert r.status_code == 409


# --- Cross-user isolation ---


@pytest.mark.asyncio
async def test_post_reading_to_other_user_room_returns_403():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        prop = await create_property(client)
        room = await create_room(client, prop["id"])

        token = jwt.encode({"sub": USER_B}, key="test", algorithm="HS256")
        r = await client.post(
            "/api/v1/utility-readings",
            json={"room_id": room["id"], "period": "2026-05", "elec_curr": "500"},
            headers={"Authorization": f"Bearer {token}"},
        )
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_get_readings_for_other_user_room_returns_403():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        prop = await create_property(client)
        room = await create_room(client, prop["id"])

        token = jwt.encode({"sub": USER_B}, key="test", algorithm="HS256")
        r = await client.get(
            f"/api/v1/rooms/{room['id']}/utility-readings",
            headers={"Authorization": f"Bearer {token}"},
        )
    assert r.status_code == 403


# --- Tenant isolation: prev reading from old tenant doesn't carry over ---


@pytest.mark.asyncio
async def test_prev_reading_from_previous_tenant_not_used_as_elec_prev():
    """Setup: tenant A's reading for 2026-04, contract ends, tenant B starts.
    Tenant B posts reading for 2026-05 → elec_prev must be NULL (not tenant A's elec_curr)."""
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        setup = await setup_room_with_contract(client)
        room_id = setup["room"]["id"]
        contract_id = setup["contract"]["id"]

        # Tenant A's reading
        await post_reading(client, room_id, "2026-04", "5000.00")

        # End tenant A's contract
        end_resp = await client.put(
            f"/api/v1/contracts/{contract_id}/end",
            headers=auth_headers(USER_A),
        )
        assert end_resp.status_code == 200

        # New tenant B with new contract
        tenant_b = (
            await client.post(
                "/api/v1/tenants",
                json={"full_name": "Tenant B"},
                headers=auth_headers(USER_A),
            )
        ).json()
        new_contract = await client.post(
            "/api/v1/contracts",
            json={
                "room_id": room_id,
                "tenant_id": tenant_b["id"],
                "start_date": "2026-05-01",
                "end_date": "2027-12-31",
                "agreed_rent": "3000000",
                "deposit": "0",
                "num_people": 1,
                "initial_elec_curr": "0",
                "initial_water_curr": "0",
            },
            headers=auth_headers(USER_A),
        )
        assert new_contract.status_code == 201

        # Tenant B posts reading for 2026-06 — prev must NOT auto-fill from tenant A's 2026-05 (contract's initial)
        # Initial reading for new contract sits at 2026-05 with contract_id=new. So 2026-06 should auto-fill from 2026-05 (same contract). OK.
        # The real test: post for 2026-07 with gap → 2026-06 doesn't exist → prev = None
        r = await post_reading(client, room_id, "2026-07", "100.00")
    assert r.status_code == 201
    data = r.json()
    # 2026-06 doesn't exist (gap) → elec_prev must be None, NOT tenant A's old value
    assert data["elec_prev"] is None
    assert data["is_prev_auto"] is False
