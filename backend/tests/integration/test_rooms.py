import pytest
from httpx import AsyncClient, ASGITransport
from jose import jwt
from app.main import app

USER_A = "user_room_a"
USER_B = "user_room_b"


def auth_headers(user_id: str) -> dict:
    token = jwt.encode({"sub": user_id}, key="test", algorithm="HS256")
    return {"Authorization": f"Bearer {token}"}


async def create_property(client: AsyncClient, user_id: str, name: str = "Test House") -> dict:
    r = await client.post(
        "/api/v1/properties",
        json={"name": name, "address": "123 Test St", "default_elec_rate": "3500", "default_water_rate": "15000"},
        headers=auth_headers(user_id),
    )
    assert r.status_code == 201
    return r.json()


@pytest.mark.asyncio
async def test_create_room():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        prop = await create_property(client, USER_A)
        r = await client.post(
            f"/api/v1/properties/{prop['id']}/rooms",
            json={"room_number": "101", "floor": 1, "rent_price": "2000000"},
            headers=auth_headers(USER_A),
        )
    assert r.status_code == 201
    data = r.json()
    assert data["room_number"] == "101"
    assert data["status"] == "vacant"


@pytest.mark.asyncio
async def test_room_created_with_correct_rent_and_status():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        prop = await create_property(client, USER_A)
        r = await client.post(
            f"/api/v1/properties/{prop['id']}/rooms",
            json={"room_number": "101", "rent_price": "2000000"},
            headers=auth_headers(USER_A),
        )
    data = r.json()
    assert r.status_code == 201
    assert float(data["rent_price"]) == 2000000
    assert data["status"] == "vacant"
    assert data["property_id"] == prop["id"]


@pytest.mark.asyncio
async def test_room_floor_and_area_optional():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        prop = await create_property(client, USER_A)
        r = await client.post(
            f"/api/v1/properties/{prop['id']}/rooms",
            json={"room_number": "102", "rent_price": "2500000", "floor": 2, "area_m2": "25.5"},
            headers=auth_headers(USER_A),
        )
    data = r.json()
    assert data["floor"] == 2
    assert float(data["area_m2"]) == 25.5


@pytest.mark.asyncio
async def test_create_room_forbidden_for_non_owner():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        prop = await create_property(client, USER_A)
        r = await client.post(
            f"/api/v1/properties/{prop['id']}/rooms",
            json={"room_number": "101", "rent_price": "2000000"},
            headers=auth_headers(USER_B),
        )
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_update_room_status():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        prop = await create_property(client, USER_A)
        room = (await client.post(
            f"/api/v1/properties/{prop['id']}/rooms",
            json={"room_number": "101", "rent_price": "2000000"},
            headers=auth_headers(USER_A),
        )).json()

        r = await client.put(
            f"/api/v1/rooms/{room['id']}",
            json={"status": "maintenance"},
            headers=auth_headers(USER_A),
        )
    assert r.status_code == 200
    assert r.json()["status"] == "maintenance"


@pytest.mark.asyncio
async def test_delete_room_forbidden_for_non_owner():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        prop = await create_property(client, USER_A)
        room = (await client.post(
            f"/api/v1/properties/{prop['id']}/rooms",
            json={"room_number": "101", "rent_price": "2000000"},
            headers=auth_headers(USER_A),
        )).json()

        r = await client.delete(f"/api/v1/rooms/{room['id']}", headers=auth_headers(USER_B))
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_duplicate_room_number_in_same_property_returns_409():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        prop = await create_property(client, USER_A)
        await client.post(
            f"/api/v1/properties/{prop['id']}/rooms",
            json={"room_number": "101", "rent_price": "2000000"},
            headers=auth_headers(USER_A),
        )
        r = await client.post(
            f"/api/v1/properties/{prop['id']}/rooms",
            json={"room_number": "101", "rent_price": "3000000"},
            headers=auth_headers(USER_A),
        )
    assert r.status_code == 409


@pytest.mark.asyncio
async def test_same_room_number_allowed_in_different_properties():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        prop_a = await create_property(client, USER_A, "House A")
        prop_b = await create_property(client, USER_A, "House B")
        r_a = await client.post(
            f"/api/v1/properties/{prop_a['id']}/rooms",
            json={"room_number": "101", "rent_price": "2000000"},
            headers=auth_headers(USER_A),
        )
        r_b = await client.post(
            f"/api/v1/properties/{prop_b['id']}/rooms",
            json={"room_number": "101", "rent_price": "2000000"},
            headers=auth_headers(USER_A),
        )
    assert r_a.status_code == 201
    assert r_b.status_code == 201


@pytest.mark.asyncio
async def test_list_rooms_only_returns_own_property_rooms():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        prop_a = await create_property(client, USER_A, "House A")
        prop_b = await create_property(client, USER_B, "House B")

        await client.post(f"/api/v1/properties/{prop_a['id']}/rooms",
            json={"room_number": "A01", "rent_price": "1000000"}, headers=auth_headers(USER_A))
        await client.post(f"/api/v1/properties/{prop_b['id']}/rooms",
            json={"room_number": "B01", "rent_price": "1000000"}, headers=auth_headers(USER_B))

        # User A cannot list rooms of User B's property
        r = await client.get(f"/api/v1/properties/{prop_b['id']}/rooms", headers=auth_headers(USER_A))
    assert r.status_code == 403
