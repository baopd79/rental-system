import pytest
from httpx import AsyncClient, ASGITransport
from jose import jwt
from app.main import app


def make_token(sub: str) -> str:
    """Create unsigned test JWT (dev mode: no JWKS_URL set)."""
    return jwt.encode({"sub": sub}, key="test", algorithm="HS256")


@pytest.mark.asyncio
async def test_me_returns_clerk_user_id():
    token = make_token("user_abc123")
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        r = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    assert r.json() == {"clerk_user_id": "user_abc123"}


@pytest.mark.asyncio
async def test_me_without_token_returns_401():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        r = await client.get("/api/v1/auth/me")
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_me_with_invalid_token_returns_401():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        r = await client.get("/api/v1/auth/me", headers={"Authorization": "Bearer not.a.token"})
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_health_no_auth_required():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        r = await client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}
