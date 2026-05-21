import pytest
from httpx import AsyncClient, ASGITransport
from jose import jwt
from app.main import app

USER_A = "user_utility_a"


def auth_headers(user_id: str) -> dict:
    token = jwt.encode({"sub": user_id}, key="test", algorithm="HS256")
    return {"Authorization": f"Bearer {token}"}


async def create_property(client: AsyncClient, water_calc_type: str = "per_meter") -> dict:
    r = await client.post(
        "/api/v1/properties",
        json={
            "name": "Test House", "address": "123 Test",
            "default_elec_rate": "3500", "default_water_rate": "15000",
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


async def post_reading(client: AsyncClient, room_id: int, period: str, elec_curr: str, water_curr: str | None = None) -> dict:
    body: dict = {"room_id": room_id, "period": period, "elec_curr": elec_curr}
    if water_curr is not None:
        body["water_curr"] = water_curr
    r = await client.post("/api/v1/utility-readings", json=body, headers=auth_headers(USER_A))
    return r


# --- First reading ---

@pytest.mark.asyncio
async def test_first_reading_has_null_prev():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        prop = await create_property(client)
        room = await create_room(client, prop["id"])

        r = await post_reading(client, room["id"], "2026-01", "1000.00")
    assert r.status_code == 201
    data = r.json()
    assert data["elec_prev"] is None
    assert data["elec_curr"] == "1000.00"
    assert data["is_prev_auto"] is False


# --- Auto-fill ---

@pytest.mark.asyncio
async def test_second_reading_auto_fills_prev():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        prop = await create_property(client)
        room = await create_room(client, prop["id"])

        await post_reading(client, room["id"], "2026-04", "1000.00", "50.00")
        r = await post_reading(client, room["id"], "2026-05", "1150.00", "62.00")

    assert r.status_code == 201
    data = r.json()
    assert data["elec_prev"] == "1000.00"
    assert data["elec_curr"] == "1150.00"
    assert data["is_prev_auto"] is True
    assert data["water_prev"] == "50.00"
    assert data["water_curr"] == "62.00"


@pytest.mark.asyncio
async def test_auto_fill_across_year_boundary():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        prop = await create_property(client)
        room = await create_room(client, prop["id"])

        await post_reading(client, room["id"], "2025-12", "5000.00")
        r = await post_reading(client, room["id"], "2026-01", "5120.00")

    assert r.status_code == 201
    data = r.json()
    assert data["elec_prev"] == "5000.00"
    assert data["is_prev_auto"] is True


# --- Validation ---

@pytest.mark.asyncio
async def test_curr_less_than_prev_returns_400():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        prop = await create_property(client)
        room = await create_room(client, prop["id"])

        await post_reading(client, room["id"], "2026-04", "1000.00")
        r = await post_reading(client, room["id"], "2026-05", "900.00")

    assert r.status_code == 400


@pytest.mark.asyncio
async def test_duplicate_period_returns_409():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        prop = await create_property(client)
        room = await create_room(client, prop["id"])

        await post_reading(client, room["id"], "2026-05", "1000.00")
        r = await post_reading(client, room["id"], "2026-05", "1100.00")

    assert r.status_code == 409


# --- Water ignored for non-per_meter ---

@pytest.mark.asyncio
async def test_water_fields_null_for_per_person_property():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        prop = await create_property(client, water_calc_type="per_person")
        room = await create_room(client, prop["id"])

        r = await post_reading(client, room["id"], "2026-05", "1000.00", water_curr="50.00")

    assert r.status_code == 201
    data = r.json()
    assert data["water_curr"] is None
    assert data["water_prev"] is None


@pytest.mark.asyncio
async def test_water_fields_null_for_per_room_property():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        prop = await create_property(client, water_calc_type="per_room")
        room = await create_room(client, prop["id"])

        r = await post_reading(client, room["id"], "2026-05", "1000.00", water_curr="50.00")

    assert r.status_code == 201
    data = r.json()
    assert data["water_curr"] is None


# --- Update/Delete: only latest ---

@pytest.mark.asyncio
async def test_update_latest_reading():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        prop = await create_property(client)
        room = await create_room(client, prop["id"])
        reading = (await post_reading(client, room["id"], "2026-05", "1000.00")).json()

        r = await client.put(
            f"/api/v1/utility-readings/{reading['id']}",
            json={"elec_curr": "1050.00"},
            headers=auth_headers(USER_A),
        )
    assert r.status_code == 200
    assert r.json()["elec_curr"] == "1050.00"


@pytest.mark.asyncio
async def test_update_non_latest_reading_returns_409():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        prop = await create_property(client)
        room = await create_room(client, prop["id"])

        old = (await post_reading(client, room["id"], "2026-04", "1000.00")).json()
        await post_reading(client, room["id"], "2026-05", "1100.00")

        r = await client.put(
            f"/api/v1/utility-readings/{old['id']}",
            json={"elec_curr": "1005.00"},
            headers=auth_headers(USER_A),
        )
    assert r.status_code == 409


@pytest.mark.asyncio
async def test_delete_latest_reading():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        prop = await create_property(client)
        room = await create_room(client, prop["id"])
        reading = (await post_reading(client, room["id"], "2026-05", "1000.00")).json()

        r = await client.delete(
            f"/api/v1/utility-readings/{reading['id']}",
            headers=auth_headers(USER_A),
        )
    assert r.status_code == 204


@pytest.mark.asyncio
async def test_delete_non_latest_reading_returns_409():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        prop = await create_property(client)
        room = await create_room(client, prop["id"])

        old = (await post_reading(client, room["id"], "2026-04", "1000.00")).json()
        await post_reading(client, room["id"], "2026-05", "1100.00")

        r = await client.delete(
            f"/api/v1/utility-readings/{old['id']}",
            headers=auth_headers(USER_A),
        )
    assert r.status_code == 409


# --- Cross-user isolation ---

USER_B = "user_utility_b"


@pytest.mark.asyncio
async def test_post_reading_to_other_user_room_returns_403():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
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
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        prop = await create_property(client)
        room = await create_room(client, prop["id"])

        token = jwt.encode({"sub": USER_B}, key="test", algorithm="HS256")
        r = await client.get(
            f"/api/v1/rooms/{room['id']}/utility-readings",
            headers={"Authorization": f"Bearer {token}"},
        )
    assert r.status_code == 403
