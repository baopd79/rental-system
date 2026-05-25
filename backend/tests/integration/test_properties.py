import pytest
from httpx import AsyncClient, ASGITransport
from jose import jwt
from app.main import app


def auth_headers(user_id: str) -> dict:
    token = jwt.encode({"sub": user_id}, key="test", algorithm="HS256")
    return {"Authorization": f"Bearer {token}"}


USER_A = "user_aaa"
USER_B = "user_bbb"


@pytest.mark.asyncio
async def test_create_property():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        r = await client.post(
            "/api/v1/properties",
            json={
                "name": "Nhà Quận 1",
                "address": "123 Lê Lợi, Q1",
                "default_elec_rate": "3500",
                "default_water_rate": "15000",
            },
            headers=auth_headers(USER_A),
        )
    assert r.status_code == 201
    data = r.json()
    assert data["name"] == "Nhà Quận 1"
    assert "clerk_user_id" not in data


@pytest.mark.asyncio
async def test_list_properties_owner_isolation():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        # User A tạo property
        await client.post(
            "/api/v1/properties",
            json={"name": "Nhà A", "address": "Địa chỉ A"},
            headers=auth_headers(USER_A),
        )
        # User B tạo property
        await client.post(
            "/api/v1/properties",
            json={"name": "Nhà B", "address": "Địa chỉ B"},
            headers=auth_headers(USER_B),
        )
        # User A chỉ thấy nhà của mình
        r_a = await client.get("/api/v1/properties", headers=auth_headers(USER_A))
        r_b = await client.get("/api/v1/properties", headers=auth_headers(USER_B))

    names_a = [p["name"] for p in r_a.json()]
    names_b = [p["name"] for p in r_b.json()]
    assert "Nhà A" in names_a and "Nhà B" not in names_a
    assert "Nhà B" in names_b and "Nhà A" not in names_b


@pytest.mark.asyncio
async def test_update_property_forbidden_for_other_user():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        r = await client.post(
            "/api/v1/properties",
            json={"name": "Nhà A", "address": "Địa chỉ A"},
            headers=auth_headers(USER_A),
        )
        prop_id = r.json()["id"]

        r_update = await client.patch(
            f"/api/v1/properties/{prop_id}",
            json={"name": "Hacked"},
            headers=auth_headers(USER_B),
        )
    assert r_update.status_code == 403


@pytest.mark.asyncio
async def test_delete_property_forbidden_for_other_user():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        r = await client.post(
            "/api/v1/properties",
            json={"name": "Nhà A", "address": "Địa chỉ A"},
            headers=auth_headers(USER_A),
        )
        prop_id = r.json()["id"]

        r_del = await client.delete(
            f"/api/v1/properties/{prop_id}", headers=auth_headers(USER_B)
        )
    assert r_del.status_code == 403


@pytest.mark.asyncio
async def test_update_and_delete_own_property():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        r = await client.post(
            "/api/v1/properties",
            json={"name": "Nhà Gốc", "address": "Địa chỉ gốc"},
            headers=auth_headers(USER_A),
        )
        prop_id = r.json()["id"]

        r_upd = await client.patch(
            f"/api/v1/properties/{prop_id}",
            json={"name": "Nhà Đã Sửa"},
            headers=auth_headers(USER_A),
        )
        assert r_upd.status_code == 200
        assert r_upd.json()["name"] == "Nhà Đã Sửa"

        r_del = await client.delete(
            f"/api/v1/properties/{prop_id}", headers=auth_headers(USER_A)
        )
        assert r_del.status_code == 204


@pytest.mark.asyncio
async def test_get_property_not_found():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        r = await client.get("/api/v1/properties/99999", headers=auth_headers(USER_A))
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_delete_property_with_rooms_returns_409():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        prop = (
            await client.post(
                "/api/v1/properties",
                json={"name": "Nhà có phòng", "address": "Địa chỉ"},
                headers=auth_headers(USER_A),
            )
        ).json()
        await client.post(
            f"/api/v1/properties/{prop['id']}/rooms",
            json={"room_number": "101", "rent_price": "2000000"},
            headers=auth_headers(USER_A),
        )
        r = await client.delete(
            f"/api/v1/properties/{prop['id']}", headers=auth_headers(USER_A)
        )
    assert r.status_code == 409
