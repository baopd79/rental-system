import pytest
from httpx import AsyncClient, ASGITransport
from jose import jwt
from app.main import app

USER_A = "user_surcharge_a"
USER_B = "user_surcharge_b"


def auth_headers(user_id: str) -> dict:
    token = jwt.encode({"sub": user_id}, key="test", algorithm="HS256")
    return {"Authorization": f"Bearer {token}"}


async def create_property(client: AsyncClient, user_id: str) -> dict:
    r = await client.post(
        "/api/v1/properties",
        json={
            "name": "Test House",
            "address": "123 Test",
            "default_elec_rate": "3500",
            "default_water_rate": "15000",
        },
        headers=auth_headers(user_id),
    )
    assert r.status_code == 201
    return r.json()


async def create_surcharge(
    client: AsyncClient, user_id: str, property_id: int, **kwargs
) -> dict:
    body = {"name": "Phí wifi", "calc_type": "per_room", "amount": "100000", **kwargs}
    r = await client.post(
        f"/api/v1/properties/{property_id}/surcharges",
        json=body,
        headers=auth_headers(user_id),
    )
    assert r.status_code == 201
    return r.json()


@pytest.mark.asyncio
async def test_create_surcharge():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        prop = await create_property(client, USER_A)
        r = await client.post(
            f"/api/v1/properties/{prop['id']}/surcharges",
            json={"name": "Phí rác", "calc_type": "per_room", "amount": "20000"},
            headers=auth_headers(USER_A),
        )
    assert r.status_code == 201
    data = r.json()
    assert data["name"] == "Phí rác"
    assert data["calc_type"] == "per_room"
    assert float(data["amount"]) == 20000
    assert data["property_id"] == prop["id"]


@pytest.mark.asyncio
async def test_create_surcharge_per_person():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        prop = await create_property(client, USER_A)
        r = await client.post(
            f"/api/v1/properties/{prop['id']}/surcharges",
            json={"name": "Phí vệ sinh", "calc_type": "per_person", "amount": "50000"},
            headers=auth_headers(USER_A),
        )
    assert r.status_code == 201
    assert r.json()["calc_type"] == "per_person"


@pytest.mark.asyncio
async def test_list_surcharges_only_returns_own_property():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        prop_a = await create_property(client, USER_A)
        prop_b = await create_property(client, USER_B)

        await create_surcharge(client, USER_A, prop_a["id"], name="WiFi A")
        await create_surcharge(client, USER_A, prop_a["id"], name="Rác A")
        await create_surcharge(client, USER_B, prop_b["id"], name="WiFi B")

        r = await client.get(
            f"/api/v1/properties/{prop_a['id']}/surcharges",
            headers=auth_headers(USER_A),
        )
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 2
    names = {s["name"] for s in data}
    assert names == {"WiFi A", "Rác A"}


@pytest.mark.asyncio
async def test_list_surcharges_other_user_property_returns_403():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        prop = await create_property(client, USER_A)
        r = await client.get(
            f"/api/v1/properties/{prop['id']}/surcharges", headers=auth_headers(USER_B)
        )
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_update_surcharge():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        prop = await create_property(client, USER_A)
        surcharge = await create_surcharge(client, USER_A, prop["id"])

        r = await client.patch(
            f"/api/v1/surcharges/{surcharge['id']}",
            json={"name": "Phí wifi mới", "amount": "150000"},
            headers=auth_headers(USER_A),
        )
    assert r.status_code == 200
    data = r.json()
    assert data["name"] == "Phí wifi mới"
    assert float(data["amount"]) == 150000


@pytest.mark.asyncio
async def test_update_surcharge_by_non_owner_returns_403():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        prop = await create_property(client, USER_A)
        surcharge = await create_surcharge(client, USER_A, prop["id"])

        r = await client.patch(
            f"/api/v1/surcharges/{surcharge['id']}",
            json={"amount": "999"},
            headers=auth_headers(USER_B),
        )
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_delete_surcharge():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        prop = await create_property(client, USER_A)
        surcharge = await create_surcharge(client, USER_A, prop["id"])

        r = await client.delete(
            f"/api/v1/surcharges/{surcharge['id']}", headers=auth_headers(USER_A)
        )
        assert r.status_code == 204

        list_r = await client.get(
            f"/api/v1/properties/{prop['id']}/surcharges", headers=auth_headers(USER_A)
        )
    assert list_r.json() == []


@pytest.mark.asyncio
async def test_delete_surcharge_by_non_owner_returns_403():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        prop = await create_property(client, USER_A)
        surcharge = await create_surcharge(client, USER_A, prop["id"])

        r = await client.delete(
            f"/api/v1/surcharges/{surcharge['id']}", headers=auth_headers(USER_B)
        )
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_post_surcharge_to_other_user_property_returns_403():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        prop = await create_property(client, USER_A)

        r = await client.post(
            f"/api/v1/properties/{prop['id']}/surcharges",
            json={"name": "Hack", "calc_type": "per_room", "amount": "999"},
            headers=auth_headers(USER_B),
        )
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_update_surcharge_by_non_owner_returns_403_patch():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        prop = await create_property(client, USER_A)
        surcharge = await create_surcharge(client, USER_A, prop["id"])

        r = await client.patch(
            f"/api/v1/surcharges/{surcharge['id']}",
            json={"name": "Hacked"},
            headers=auth_headers(USER_B),
        )
    assert r.status_code == 403
