from __future__ import annotations

import base64
import time

import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from httpx import ASGITransport, AsyncClient
from jose import jwt

import app.core.clerk as clerk_module
from app.core.config import settings
from app.main import app


def make_token(sub: str) -> str:
    """Create unsigned test JWT (AUTH_DEV_MODE on)."""
    return jwt.encode({"sub": sub}, key="test", algorithm="HS256")


@pytest.mark.asyncio
async def test_me_returns_clerk_user_id():
    token = make_token("user_abc123")
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        r = await client.get(
            "/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"}
        )
    assert r.status_code == 200
    assert r.json() == {"clerk_user_id": "user_abc123"}


@pytest.mark.asyncio
async def test_me_without_token_returns_401():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        r = await client.get("/api/v1/auth/me")
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_me_with_invalid_token_returns_401():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        r = await client.get(
            "/api/v1/auth/me", headers={"Authorization": "Bearer not.a.token"}
        )
    assert r.status_code == 401
    # Error must not leak internal JWT decode details.
    assert r.json()["detail"] == "Invalid token"


@pytest.mark.asyncio
async def test_me_dev_mode_missing_sub_returns_401():
    token = jwt.encode({"foo": "bar"}, key="test", algorithm="HS256")
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        r = await client.get(
            "/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"}
        )
    assert r.status_code == 401
    assert r.json()["detail"] == "Invalid token"


@pytest.mark.asyncio
async def test_health_no_auth_required():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        r = await client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


@pytest.mark.asyncio
async def test_dev_mode_off_without_jwks_url_rejects():
    """Fail-closed: empty JWKS URL with dev-mode off must reject every request."""
    settings.AUTH_DEV_MODE = False
    settings.CLERK_JWKS_URL = ""
    token = make_token("user_abc123")
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        r = await client.get(
            "/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"}
        )
    assert r.status_code == 401
    assert r.json()["detail"] == "Auth not configured"


# --- Production-path tests with a fake JWKS -----------------------------------


def _b64url_uint(value: int) -> str:
    raw = value.to_bytes((value.bit_length() + 7) // 8, "big")
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()


@pytest.fixture
def rsa_keypair():
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    pub = key.public_key().public_numbers()
    jwk = {
        "kty": "RSA",
        "kid": "test-key-1",
        "use": "sig",
        "alg": "RS256",
        "n": _b64url_uint(pub.n),
        "e": _b64url_uint(pub.e),
    }
    pem = key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    )
    return pem, jwk


@pytest.fixture
def patch_jwks(monkeypatch):
    def _apply(jwks: dict):
        async def fake_fetch():
            return jwks

        monkeypatch.setattr(clerk_module, "_fetch_jwks", fake_fetch)

    return _apply


def _sign(pem: bytes, claims: dict, kid: str = "test-key-1") -> str:
    return jwt.encode(claims, pem, algorithm="RS256", headers={"kid": kid})


@pytest.mark.asyncio
async def test_production_path_valid_token(rsa_keypair, patch_jwks):
    pem, jwk = rsa_keypair
    patch_jwks({"keys": [jwk]})
    settings.AUTH_DEV_MODE = False
    settings.CLERK_JWKS_URL = "https://example.test/.well-known/jwks.json"
    settings.CLERK_ISSUER = "https://example.test"

    now = int(time.time())
    token = _sign(
        pem,
        {
            "sub": "user_prod_1",
            "iss": "https://example.test",
            "iat": now,
            "exp": now + 300,
        },
    )
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        r = await client.get(
            "/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"}
        )
    assert r.status_code == 200
    assert r.json() == {"clerk_user_id": "user_prod_1"}


@pytest.mark.asyncio
async def test_production_path_wrong_issuer_rejected(rsa_keypair, patch_jwks):
    pem, jwk = rsa_keypair
    patch_jwks({"keys": [jwk]})
    settings.AUTH_DEV_MODE = False
    settings.CLERK_JWKS_URL = "https://example.test/.well-known/jwks.json"
    settings.CLERK_ISSUER = "https://example.test"

    now = int(time.time())
    token = _sign(
        pem,
        {
            "sub": "user_prod_1",
            "iss": "https://attacker.test",
            "iat": now,
            "exp": now + 300,
        },
    )
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        r = await client.get(
            "/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"}
        )
    assert r.status_code == 401
    assert r.json()["detail"] == "Invalid token"


@pytest.mark.asyncio
async def test_production_path_expired_token_rejected(rsa_keypair, patch_jwks):
    pem, jwk = rsa_keypair
    patch_jwks({"keys": [jwk]})
    settings.AUTH_DEV_MODE = False
    settings.CLERK_JWKS_URL = "https://example.test/.well-known/jwks.json"

    now = int(time.time())
    token = _sign(pem, {"sub": "user_prod_1", "iat": now - 3600, "exp": now - 60})
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        r = await client.get(
            "/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"}
        )
    assert r.status_code == 401
    assert r.json()["detail"] == "Invalid token"


@pytest.mark.asyncio
async def test_production_path_kid_rotation_triggers_refresh(monkeypatch, rsa_keypair):
    """Token signed with a kid not in cache should trigger one JWKS refresh."""
    pem, jwk = rsa_keypair
    settings.AUTH_DEV_MODE = False
    settings.CLERK_JWKS_URL = "https://example.test/.well-known/jwks.json"

    # First fetch returns a stale JWKS (no matching kid); second fetch returns the real one.
    calls = {"n": 0}

    async def fake_fetch():
        calls["n"] += 1
        if calls["n"] == 1:
            return {"keys": [{**jwk, "kid": "old-key"}]}
        return {"keys": [jwk]}

    monkeypatch.setattr(clerk_module, "_fetch_jwks", fake_fetch)

    now = int(time.time())
    token = _sign(pem, {"sub": "user_rot", "iat": now, "exp": now + 300})
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        r = await client.get(
            "/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"}
        )
    assert r.status_code == 200
    assert calls["n"] == 2
