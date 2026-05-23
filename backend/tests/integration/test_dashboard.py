import pytest
from httpx import AsyncClient, ASGITransport
from jose import jwt
from app.main import app

USER_A = "user_dashboard_a"
USER_B = "user_dashboard_b"


def auth_headers(user_id: str) -> dict:
    token = jwt.encode({"sub": user_id}, key="test", algorithm="HS256")
    return {"Authorization": f"Bearer {token}"}


async def setup_property_room_contract_invoice(
    client: AsyncClient,
    user_id: str,
    period: str = "2026-05",
    invoice_status: str = "draft",
    property_name: str = "Test House",
) -> dict:
    """Create property → room → tenant → contract → reading → invoice. Returns invoice."""
    prop = (
        await client.post(
            "/api/v1/properties",
            json={
                "name": property_name,
                "address": "123 Test",
                "default_elec_rate": "3500",
                "default_water_rate": "15000",
                "water_calc_type": "per_meter",
            },
            headers=auth_headers(user_id),
        )
    ).json()
    room = (
        await client.post(
            f"/api/v1/properties/{prop['id']}/rooms",
            json={"room_number": "101", "rent_price": "3000000", "deposit": "3000000"},
            headers=auth_headers(user_id),
        )
    ).json()
    tenant = (
        await client.post(
            "/api/v1/tenants",
            json={"full_name": "Nguyễn Văn A"},
            headers=auth_headers(user_id),
        )
    ).json()
    contract = (
        await client.post(
            "/api/v1/contracts",
            json={
                "room_id": room["id"],
                "tenant_id": tenant["id"],
                "start_date": "2026-01-01",
                "end_date": "2026-12-31",
                "agreed_rent": "3000000",
                "deposit": "3000000",
                "num_people": 2,
            },
            headers=auth_headers(user_id),
        )
    ).json()
    await client.post(
        "/api/v1/utility-readings",
        json={"room_id": room["id"], "period": period, "elec_curr": "1000"},
        headers=auth_headers(user_id),
    )
    invoice = (
        await client.post(
            "/api/v1/invoices/generate",
            json={"contract_id": contract["id"], "period": period},
            headers=auth_headers(user_id),
        )
    ).json()
    if invoice_status != "draft":
        await client.put(
            f"/api/v1/invoices/{invoice['id']}/status",
            json={"status": invoice_status},
            headers=auth_headers(user_id),
        )
    return invoice


# --- Summary: empty state ---


@pytest.mark.asyncio
async def test_summary_empty_for_new_user():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        r = await client.get("/api/v1/dashboard/summary", headers=auth_headers(USER_A))

    assert r.status_code == 200
    data = r.json()
    assert data["properties"] == 0
    assert data["active_contracts"] == 0
    assert data["unpaid_invoices"] == 0
    assert data["unpaid_total"] == 0.0
    assert data["rooms"]["total"] == 0
    assert data["expiring_contracts"] == []
    assert data["unpaid_invoice_list"] == []


# --- Summary: counts ---


@pytest.mark.asyncio
async def test_summary_counts_properties_and_rooms():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        prop = (
            await client.post(
                "/api/v1/properties",
                json={
                    "name": "House 1",
                    "address": "Addr 1",
                    "default_elec_rate": "3500",
                    "default_water_rate": "15000",
                },
                headers=auth_headers(USER_A),
            )
        ).json()
        for i in range(3):
            await client.post(
                f"/api/v1/properties/{prop['id']}/rooms",
                json={
                    "room_number": str(i + 1),
                    "rent_price": "2000000",
                    "deposit": "2000000",
                },
                headers=auth_headers(USER_A),
            )

        r = await client.get("/api/v1/dashboard/summary", headers=auth_headers(USER_A))

    assert r.status_code == 200
    data = r.json()
    assert data["properties"] == 1
    assert data["rooms"]["total"] == 3
    assert data["rooms"]["vacant"] == 3
    assert data["rooms"]["occupied"] == 0


@pytest.mark.asyncio
async def test_summary_counts_active_contract():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        await setup_property_room_contract_invoice(client, USER_A)
        r = await client.get("/api/v1/dashboard/summary", headers=auth_headers(USER_A))

    data = r.json()
    assert data["active_contracts"] == 1
    assert data["rooms"]["occupied"] == 1


@pytest.mark.asyncio
async def test_summary_unpaid_invoices_includes_draft_and_sent():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        draft_inv = await setup_property_room_contract_invoice(
            client, USER_A, period="2026-05"
        )
        r = await client.get("/api/v1/dashboard/summary", headers=auth_headers(USER_A))

    data = r.json()
    assert data["unpaid_invoices"] == 1
    assert data["unpaid_total"] == float(draft_inv["total"])
    assert len(data["unpaid_invoice_list"]) == 1
    assert data["unpaid_invoice_list"][0]["invoice_id"] == draft_inv["id"]


@pytest.mark.asyncio
async def test_summary_paid_invoice_not_in_unpaid():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        await setup_property_room_contract_invoice(
            client, USER_A, invoice_status="paid"
        )
        r = await client.get("/api/v1/dashboard/summary", headers=auth_headers(USER_A))

    data = r.json()
    assert data["unpaid_invoices"] == 0
    assert data["unpaid_total"] == 0.0


# --- Summary: cross-user isolation ---


@pytest.mark.asyncio
async def test_summary_isolates_by_user():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        await setup_property_room_contract_invoice(client, USER_A, property_name="Test House A1")
        await setup_property_room_contract_invoice(client, USER_A, property_name="Test House A2")

        r_a = await client.get(
            "/api/v1/dashboard/summary", headers=auth_headers(USER_A)
        )
        r_b = await client.get(
            "/api/v1/dashboard/summary", headers=auth_headers(USER_B)
        )

    assert r_a.json()["properties"] == 2
    assert r_b.json()["properties"] == 0
    assert r_b.json()["active_contracts"] == 0


# --- Revenue ---


@pytest.mark.asyncio
async def test_revenue_always_returns_12_months():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        r = await client.get(
            "/api/v1/dashboard/revenue?year=2026", headers=auth_headers(USER_A)
        )

    assert r.status_code == 200
    data = r.json()
    assert data["year"] == 2026
    assert len(data["months"]) == 12
    assert data["months"][0]["month"] == "2026-01"
    assert data["months"][11]["month"] == "2026-12"
    assert all(m["total"] == 0.0 for m in data["months"])


@pytest.mark.asyncio
async def test_revenue_counts_paid_invoices():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        paid_inv = await setup_property_room_contract_invoice(
            client, USER_A, period="2026-05", invoice_status="paid"
        )
        r = await client.get(
            "/api/v1/dashboard/revenue?year=2026", headers=auth_headers(USER_A)
        )

    data = r.json()
    may = next(m for m in data["months"] if m["month"] == "2026-05")
    assert may["total"] == float(paid_inv["total"])
    assert data["total_year"] == float(paid_inv["total"])


@pytest.mark.asyncio
async def test_revenue_excludes_unpaid_invoices():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        await setup_property_room_contract_invoice(
            client, USER_A, period="2026-05", invoice_status="draft"
        )
        r = await client.get(
            "/api/v1/dashboard/revenue?year=2026", headers=auth_headers(USER_A)
        )

    data = r.json()
    assert data["total_year"] == 0.0


@pytest.mark.asyncio
async def test_revenue_isolates_by_user():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        await setup_property_room_contract_invoice(
            client, USER_A, period="2026-05", invoice_status="paid"
        )
        r_b = await client.get(
            "/api/v1/dashboard/revenue?year=2026", headers=auth_headers(USER_B)
        )

    assert r_b.json()["total_year"] == 0.0
