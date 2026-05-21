import pytest
from httpx import AsyncClient, ASGITransport
from jose import jwt
from app.main import app

USER_A = "user_billing_a"
USER_B = "user_billing_b"


def auth_headers(user_id: str) -> dict:
    token = jwt.encode({"sub": user_id}, key="test", algorithm="HS256")
    return {"Authorization": f"Bearer {token}"}


async def setup_property_room(client: AsyncClient, user_id: str) -> tuple[dict, dict]:
    prop = (await client.post(
        "/api/v1/properties",
        json={"name": "Test", "address": "Test",
              "default_elec_rate": "3500", "default_water_rate": "15000",
              "water_calc_type": "per_meter"},
        headers=auth_headers(user_id),
    )).json()
    room = (await client.post(
        f"/api/v1/properties/{prop['id']}/rooms",
        json={"room_number": "101", "rent_price": "3000000"},
        headers=auth_headers(user_id),
    )).json()
    return prop, room


async def setup_contract(client: AsyncClient, user_id: str, room_id: int,
                         start: str = "2026-01-01", end: str = "2026-12-31") -> dict:
    tenant = (await client.post(
        "/api/v1/tenants", json={"full_name": "Test Tenant"}, headers=auth_headers(user_id),
    )).json()
    return (await client.post(
        "/api/v1/contracts",
        json={"room_id": room_id, "tenant_id": tenant["id"],
              "start_date": start, "end_date": end,
              "agreed_rent": "3000000", "deposit": "0", "num_people": 1},
        headers=auth_headers(user_id),
    )).json()


async def batch_readings(client, user_id, property_id, period, readings):
    return await client.post(
        f"/api/v1/properties/{property_id}/billing/readings",
        json={"period": period, "readings": readings},
        headers=auth_headers(user_id),
    )


# ── Contract-id isolation ──────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_new_tenant_elec_prev_is_null_not_inherited_from_old_tenant():
    """Prior tenant's elec_curr must never become new tenant's elec_prev."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        prop, room = await setup_property_room(client, USER_A)

        # Tenant 1: active Jan–Mar, reading for 2026-03
        contract1 = await setup_contract(client, USER_A, room["id"], "2026-01-01", "2026-03-31")
        await batch_readings(client, USER_A, prop["id"], "2026-03",
                             [{"room_id": room["id"], "elec_curr": "500"}])
        await client.put(f"/api/v1/contracts/{contract1['id']}/end", headers=auth_headers(USER_A))

        # Tenant 2: starts Apr, enters reading for 2026-04
        await setup_contract(client, USER_A, room["id"], "2026-04-01", "2026-12-31")
        r = await batch_readings(client, USER_A, prop["id"], "2026-04",
                                 [{"room_id": room["id"], "elec_curr": "600"}])

    assert r.status_code == 200
    row = next(x for x in r.json() if x["room_id"] == room["id"])
    # elec_prev should be NULL — tenant 2 has no previous reading in their own contract
    assert row["elec_prev"] is None
    assert row["elec_curr"] == "600.00" or float(row["elec_curr"]) == 600


# ── Month-skip guard ───────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_month_skip_within_same_contract_returns_400():
    """Cannot skip months within the same contract."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        prop, room = await setup_property_room(client, USER_A)
        await setup_contract(client, USER_A, room["id"])

        # Enter March reading
        await batch_readings(client, USER_A, prop["id"], "2026-03",
                             [{"room_id": room["id"], "elec_curr": "300"}])

        # Skip April, go straight to May → should fail
        r = await batch_readings(client, USER_A, prop["id"], "2026-05",
                                 [{"room_id": room["id"], "elec_curr": "500"}])

    assert r.status_code == 400


@pytest.mark.asyncio
async def test_month_skip_guard_does_not_block_new_tenant():
    """Old tenant's gap must not block new tenant from entering their first reading."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        prop, room = await setup_property_room(client, USER_A)

        # Tenant 1 ends after March (has reading for 2026-03, no April)
        contract1 = await setup_contract(client, USER_A, room["id"], "2026-01-01", "2026-03-31")
        await batch_readings(client, USER_A, prop["id"], "2026-03",
                             [{"room_id": room["id"], "elec_curr": "300"}])
        await client.put(f"/api/v1/contracts/{contract1['id']}/end", headers=auth_headers(USER_A))

        # Tenant 2 starts May — entering 2026-05 directly (gap of April from tenant 1's history)
        await setup_contract(client, USER_A, room["id"], "2026-05-01", "2026-12-31")
        r = await batch_readings(client, USER_A, prop["id"], "2026-05",
                                 [{"room_id": room["id"], "elec_curr": "500"}])

    assert r.status_code == 200


# ── Edit-lock ─────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_edit_locked_when_downstream_reading_exists():
    """Cannot edit period N if period N+1 already has a reading."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        prop, room = await setup_property_room(client, USER_A)
        await setup_contract(client, USER_A, room["id"])

        await batch_readings(client, USER_A, prop["id"], "2026-04",
                             [{"room_id": room["id"], "elec_curr": "400"}])
        await batch_readings(client, USER_A, prop["id"], "2026-05",
                             [{"room_id": room["id"], "elec_curr": "500"}])

        # Now try to edit April — should be blocked
        r = await batch_readings(client, USER_A, prop["id"], "2026-04",
                                 [{"room_id": room["id"], "elec_curr": "410"}])

    assert r.status_code == 400


@pytest.mark.asyncio
async def test_edit_locked_when_invoice_exists():
    """Cannot edit period N if an invoice for that period already exists."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        prop, room = await setup_property_room(client, USER_A)
        contract = await setup_contract(client, USER_A, room["id"])

        await batch_readings(client, USER_A, prop["id"], "2026-05",
                             [{"room_id": room["id"], "elec_curr": "500"}])

        # Generate invoice for May
        await client.post(
            "/api/v1/invoices/generate",
            json={"contract_id": contract["id"], "period": "2026-05"},
            headers=auth_headers(USER_A),
        )

        # Try to edit May reading — should be blocked
        r = await batch_readings(client, USER_A, prop["id"], "2026-05",
                                 [{"room_id": room["id"], "elec_curr": "510"}])

    assert r.status_code == 400


# ── Isolation ─────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_batch_readings_forbidden_for_other_user():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        prop, room = await setup_property_room(client, USER_A)
        await setup_contract(client, USER_A, room["id"])

        r = await client.post(
            f"/api/v1/properties/{prop['id']}/billing/readings",
            json={"period": "2026-05", "readings": [{"room_id": room["id"], "elec_curr": "500"}]},
            headers=auth_headers(USER_B),
        )

    assert r.status_code == 403
