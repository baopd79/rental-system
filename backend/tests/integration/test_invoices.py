import pytest
from httpx import AsyncClient, ASGITransport
from jose import jwt
from app.main import app

USER_A = "user_invoice_a"
USER_B = "user_invoice_b"


def auth_headers(user_id: str) -> dict:
    token = jwt.encode({"sub": user_id}, key="test", algorithm="HS256")
    return {"Authorization": f"Bearer {token}"}


async def setup_property_room_contract(client: AsyncClient, user_id: str, water_calc_type: str = "per_meter") -> tuple[dict, dict, dict]:
    prop = (await client.post(
        "/api/v1/properties",
        json={"name": "Test House", "address": "123 Test",
              "default_elec_rate": "3500", "default_water_rate": "15000",
              "water_calc_type": water_calc_type},
        headers=auth_headers(user_id),
    )).json()
    room = (await client.post(
        f"/api/v1/properties/{prop['id']}/rooms",
        json={"room_number": "101", "rent_price": "3000000", "deposit": "3000000"},
        headers=auth_headers(user_id),
    )).json()
    tenant = (await client.post(
        "/api/v1/tenants",
        json={"full_name": "Nguyễn Văn A"},
        headers=auth_headers(user_id),
    )).json()
    contract = (await client.post(
        "/api/v1/contracts",
        json={"room_id": room["id"], "tenant_id": tenant["id"],
              "start_date": "2026-01-01", "end_date": "2026-12-31",
              "agreed_rent": "3000000", "deposit": "3000000", "num_people": 2},
        headers=auth_headers(user_id),
    )).json()
    return prop, room, contract


async def post_reading(client: AsyncClient, user_id: str, room_id: int, period: str,
                       elec_curr: str, water_curr: str | None = None) -> dict:
    body = {"room_id": room_id, "period": period, "elec_curr": elec_curr}
    if water_curr:
        body["water_curr"] = water_curr
    return (await client.post("/api/v1/utility-readings", json=body, headers=auth_headers(user_id))).json()


async def generate(client: AsyncClient, user_id: str, contract_id: int, period: str):
    return await client.post(
        "/api/v1/invoices/generate",
        json={"contract_id": contract_id, "period": period},
        headers=auth_headers(user_id),
    )


# --- Generate ---

@pytest.mark.asyncio
async def test_generate_invoice_no_reading():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        _, _, contract = await setup_property_room_contract(client, USER_A)
        r = await generate(client, USER_A, contract["id"], "2026-05")

    assert r.status_code == 201
    data = r.json()
    assert data["status"] == "draft"
    assert data["period"] == "2026-05"
    assert data["public_token"]
    item_types = {i["item_type"] for i in data["items"]}
    assert "rent" in item_types
    assert "electricity" in item_types
    assert "water" in item_types
    # elec and water = 0 when no reading
    elec = next(i for i in data["items"] if i["item_type"] == "electricity")
    assert float(elec["amount"]) == 0


@pytest.mark.asyncio
async def test_generate_invoice_with_reading():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        _, room, contract = await setup_property_room_contract(client, USER_A)

        # First reading (prev=NULL)
        await post_reading(client, USER_A, room["id"], "2026-04", "1000.00", "40.00")
        # Second reading (auto-fill prev)
        await post_reading(client, USER_A, room["id"], "2026-05", "1150.00", "55.00")

        r = await generate(client, USER_A, contract["id"], "2026-05")

    assert r.status_code == 201
    data = r.json()
    elec = next(i for i in data["items"] if i["item_type"] == "electricity")
    water = next(i for i in data["items"] if i["item_type"] == "water")
    # elec: 150 kWh × 3500 = 525000
    assert float(elec["amount"]) == 525000
    # water: 15 m³ × 15000 = 225000
    assert float(water["amount"]) == 225000


@pytest.mark.asyncio
async def test_generate_with_surcharge():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        prop, _, contract = await setup_property_room_contract(client, USER_A)
        await client.post(
            f"/api/v1/properties/{prop['id']}/surcharges",
            json={"name": "Phí wifi", "calc_type": "per_room", "amount": "100000"},
            headers=auth_headers(USER_A),
        )
        r = await generate(client, USER_A, contract["id"], "2026-05")

    assert r.status_code == 201
    sc_items = [i for i in r.json()["items"] if i["item_type"] == "surcharge"]
    assert len(sc_items) == 1
    assert sc_items[0]["name"] == "Phí wifi"
    assert float(sc_items[0]["amount"]) == 100000


@pytest.mark.asyncio
async def test_generate_duplicate_period_returns_409():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        _, _, contract = await setup_property_room_contract(client, USER_A)
        await generate(client, USER_A, contract["id"], "2026-05")
        r = await generate(client, USER_A, contract["id"], "2026-05")

    assert r.status_code == 409


@pytest.mark.asyncio
async def test_generate_other_user_contract_returns_403():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        _, _, contract = await setup_property_room_contract(client, USER_A)
        r = await client.post(
            "/api/v1/invoices/generate",
            json={"contract_id": contract["id"], "period": "2026-05"},
            headers=auth_headers(USER_B),
        )

    assert r.status_code == 403


# --- Status transitions ---

@pytest.mark.asyncio
async def test_transition_draft_to_sent():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        _, _, contract = await setup_property_room_contract(client, USER_A)
        invoice = (await generate(client, USER_A, contract["id"], "2026-05")).json()

        r = await client.put(
            f"/api/v1/invoices/{invoice['id']}/status",
            json={"status": "sent"},
            headers=auth_headers(USER_A),
        )
    assert r.status_code == 200
    assert r.json()["status"] == "sent"


@pytest.mark.asyncio
async def test_transition_draft_to_paid():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        _, _, contract = await setup_property_room_contract(client, USER_A)
        invoice = (await generate(client, USER_A, contract["id"], "2026-05")).json()

        r = await client.put(
            f"/api/v1/invoices/{invoice['id']}/status",
            json={"status": "paid"},
            headers=auth_headers(USER_A),
        )
    assert r.status_code == 200
    assert r.json()["status"] == "paid"


@pytest.mark.asyncio
async def test_transition_paid_to_draft_invalid():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        _, _, contract = await setup_property_room_contract(client, USER_A)
        invoice = (await generate(client, USER_A, contract["id"], "2026-05")).json()
        await client.put(f"/api/v1/invoices/{invoice['id']}/status",
                         json={"status": "paid"}, headers=auth_headers(USER_A))

        r = await client.put(f"/api/v1/invoices/{invoice['id']}/status",
                              json={"status": "draft"}, headers=auth_headers(USER_A))
    assert r.status_code == 400


# --- Delete ---

@pytest.mark.asyncio
async def test_delete_draft_invoice():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        _, _, contract = await setup_property_room_contract(client, USER_A)
        invoice = (await generate(client, USER_A, contract["id"], "2026-05")).json()

        r = await client.delete(f"/api/v1/invoices/{invoice['id']}", headers=auth_headers(USER_A))
    assert r.status_code == 204


@pytest.mark.asyncio
async def test_delete_sent_invoice_returns_400():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        _, _, contract = await setup_property_room_contract(client, USER_A)
        invoice = (await generate(client, USER_A, contract["id"], "2026-05")).json()
        await client.put(f"/api/v1/invoices/{invoice['id']}/status",
                         json={"status": "sent"}, headers=auth_headers(USER_A))

        r = await client.delete(f"/api/v1/invoices/{invoice['id']}", headers=auth_headers(USER_A))
    assert r.status_code == 400


# --- Public token ---

@pytest.mark.asyncio
async def test_public_token_accessible_without_auth():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        _, _, contract = await setup_property_room_contract(client, USER_A)
        invoice = (await generate(client, USER_A, contract["id"], "2026-05")).json()
        token = invoice["public_token"]

        r = await client.get(f"/api/v1/invoices/public/{token}")
    assert r.status_code == 200
    assert r.json()["id"] == invoice["id"]


@pytest.mark.asyncio
async def test_invalid_public_token_returns_404():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        r = await client.get("/api/v1/invoices/public/invalid-token-xyz")
    assert r.status_code == 404
