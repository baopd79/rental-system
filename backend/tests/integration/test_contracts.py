import pytest
from httpx import AsyncClient, ASGITransport
from jose import jwt
from app.main import app

USER_A = "user_contract_a"
USER_B = "user_contract_b"


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


async def create_room(
    client: AsyncClient, user_id: str, property_id: int, room_number: str = "101"
) -> dict:
    r = await client.post(
        f"/api/v1/properties/{property_id}/rooms",
        json={
            "room_number": room_number,
            "rent_price": "3000000",
            "deposit": "3000000",
        },
        headers=auth_headers(user_id),
    )
    assert r.status_code == 201
    return r.json()


async def create_tenant(
    client: AsyncClient, user_id: str, name: str = "Nguyễn Văn A"
) -> dict:
    r = await client.post(
        "/api/v1/tenants",
        json={"full_name": name, "phone": "0901234567"},
        headers=auth_headers(user_id),
    )
    assert r.status_code == 201
    return r.json()


async def create_contract(
    client: AsyncClient, user_id: str, room_id: int, tenant_id: int
) -> dict:
    r = await client.post(
        "/api/v1/contracts",
        json={
            "room_id": room_id,
            "tenant_id": tenant_id,
            "start_date": "2026-01-01",
            "end_date": "2026-12-31",
            "agreed_rent": "3000000",
            "deposit": "3000000",
            "num_people": 2,
        },
        headers=auth_headers(user_id),
    )
    return r


# --- Tenant CRUD ---


@pytest.mark.asyncio
async def test_create_tenant():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        r = await client.post(
            "/api/v1/tenants",
            json={
                "full_name": "Trần Thị B",
                "phone": "0912345678",
                "cccd": "012345678901",
            },
            headers=auth_headers(USER_A),
        )
    assert r.status_code == 201
    data = r.json()
    assert data["full_name"] == "Trần Thị B"
    assert data["phone"] == "0912345678"


@pytest.mark.asyncio
async def test_get_tenant_from_other_user_returns_403():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        tenant = await create_tenant(client, USER_A)
        r = await client.get(
            f"/api/v1/tenants/{tenant['id']}", headers=auth_headers(USER_B)
        )
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_update_tenant():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        tenant = await create_tenant(client, USER_A)
        r = await client.put(
            f"/api/v1/tenants/{tenant['id']}",
            json={"phone": "0999999999"},
            headers=auth_headers(USER_A),
        )
    assert r.status_code == 200
    assert r.json()["phone"] == "0999999999"


# --- Contract create ---


@pytest.mark.asyncio
async def test_create_contract_sets_room_occupied():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        prop = await create_property(client, USER_A)
        room = await create_room(client, USER_A, prop["id"])
        tenant = await create_tenant(client, USER_A)

        assert room["status"] == "vacant"

        r = await create_contract(client, USER_A, room["id"], tenant["id"])
        assert r.status_code == 201
        data = r.json()
        assert data["status"] == "active"
        assert data["num_people"] == 2
        assert data["tenant"]["full_name"] == tenant["full_name"]

        # Room should now be occupied
        room_r = await client.get(
            f"/api/v1/rooms/{room['id']}", headers=auth_headers(USER_A)
        )
        assert room_r.json()["status"] == "occupied"


@pytest.mark.asyncio
async def test_create_contract_on_occupied_room_returns_400():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        prop = await create_property(client, USER_A)
        room = await create_room(client, USER_A, prop["id"])
        tenant = await create_tenant(client, USER_A)

        await create_contract(client, USER_A, room["id"], tenant["id"])

        tenant2 = await create_tenant(client, USER_A, "Lê Văn C")
        r = await create_contract(client, USER_A, room["id"], tenant2["id"])
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_create_contract_on_maintenance_room_returns_400():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        prop = await create_property(client, USER_A)
        room = await create_room(client, USER_A, prop["id"])
        tenant = await create_tenant(client, USER_A)

        await client.patch(
            f"/api/v1/rooms/{room['id']}",
            json={"status": "maintenance"},
            headers=auth_headers(USER_A),
        )

        r = await create_contract(client, USER_A, room["id"], tenant["id"])
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_create_contract_invalid_dates_returns_400():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        prop = await create_property(client, USER_A)
        room = await create_room(client, USER_A, prop["id"])
        tenant = await create_tenant(client, USER_A)

        r = await client.post(
            "/api/v1/contracts",
            json={
                "room_id": room["id"],
                "tenant_id": tenant["id"],
                "start_date": "2026-06-01",
                "end_date": "2026-01-01",
                "agreed_rent": "3000000",
                "num_people": 1,
            },
            headers=auth_headers(USER_A),
        )
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_create_contract_zero_people_returns_400():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        prop = await create_property(client, USER_A)
        room = await create_room(client, USER_A, prop["id"])
        tenant = await create_tenant(client, USER_A)

        r = await client.post(
            "/api/v1/contracts",
            json={
                "room_id": room["id"],
                "tenant_id": tenant["id"],
                "start_date": "2026-01-01",
                "end_date": "2026-12-31",
                "agreed_rent": "3000000",
                "num_people": 0,
            },
            headers=auth_headers(USER_A),
        )
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_create_contract_on_other_user_room_returns_403():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        prop = await create_property(client, USER_A)
        room = await create_room(client, USER_A, prop["id"])
        tenant = await create_tenant(client, USER_B)

        r = await client.post(
            "/api/v1/contracts",
            json={
                "room_id": room["id"],
                "tenant_id": tenant["id"],
                "start_date": "2026-01-01",
                "end_date": "2026-12-31",
                "agreed_rent": "3000000",
                "num_people": 1,
            },
            headers=auth_headers(USER_B),
        )
    assert r.status_code == 403


# --- Contract end ---


@pytest.mark.asyncio
async def test_end_contract_sets_room_vacant():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        prop = await create_property(client, USER_A)
        room = await create_room(client, USER_A, prop["id"])
        tenant = await create_tenant(client, USER_A)
        contract = (
            await create_contract(client, USER_A, room["id"], tenant["id"])
        ).json()

        r = await client.put(
            f"/api/v1/contracts/{contract['id']}/end", headers=auth_headers(USER_A)
        )
        assert r.status_code == 200
        assert r.json()["status"] == "ended"

        room_r = await client.get(
            f"/api/v1/rooms/{room['id']}", headers=auth_headers(USER_A)
        )
        assert room_r.json()["status"] == "vacant"


@pytest.mark.asyncio
async def test_end_contract_already_ended_returns_400():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        prop = await create_property(client, USER_A)
        room = await create_room(client, USER_A, prop["id"])
        tenant = await create_tenant(client, USER_A)
        contract = (
            await create_contract(client, USER_A, room["id"], tenant["id"])
        ).json()

        await client.put(
            f"/api/v1/contracts/{contract['id']}/end", headers=auth_headers(USER_A)
        )
        r = await client.put(
            f"/api/v1/contracts/{contract['id']}/end", headers=auth_headers(USER_A)
        )
    assert r.status_code == 400


# --- Room delete guard ---


@pytest.mark.asyncio
async def test_delete_room_with_active_contract_returns_409():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        prop = await create_property(client, USER_A)
        room = await create_room(client, USER_A, prop["id"])
        tenant = await create_tenant(client, USER_A)
        await create_contract(client, USER_A, room["id"], tenant["id"])

        r = await client.delete(
            f"/api/v1/rooms/{room['id']}", headers=auth_headers(USER_A)
        )
    assert r.status_code == 409


@pytest.mark.asyncio
async def test_delete_room_with_ended_contract_also_returns_409():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        prop = await create_property(client, USER_A)
        room = await create_room(client, USER_A, prop["id"])
        tenant = await create_tenant(client, USER_A)
        contract = (
            await create_contract(client, USER_A, room["id"], tenant["id"])
        ).json()
        await client.put(
            f"/api/v1/contracts/{contract['id']}/end", headers=auth_headers(USER_A)
        )

        r = await client.delete(
            f"/api/v1/rooms/{room['id']}", headers=auth_headers(USER_A)
        )
    assert r.status_code == 409


# --- Contract history ---


@pytest.mark.asyncio
async def test_list_room_contracts_returns_history():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        prop = await create_property(client, USER_A)
        room = await create_room(client, USER_A, prop["id"])
        tenant = await create_tenant(client, USER_A)
        contract = (
            await create_contract(client, USER_A, room["id"], tenant["id"])
        ).json()
        await client.put(
            f"/api/v1/contracts/{contract['id']}/end", headers=auth_headers(USER_A)
        )

        tenant2 = await create_tenant(client, USER_A, "Phạm Thị D")
        await create_contract(client, USER_A, room["id"], tenant2["id"])

        r = await client.get(
            f"/api/v1/rooms/{room['id']}/contracts", headers=auth_headers(USER_A)
        )
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 2
    statuses = {c["status"] for c in data}
    assert statuses == {"active", "ended"}
