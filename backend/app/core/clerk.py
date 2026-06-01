import asyncio
import logging
import time

import httpx
from fastapi import Security
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from app.core.config import settings
from app.core.exceptions import UnauthorizedException

logger = logging.getLogger(__name__)

_bearer = HTTPBearer(auto_error=False)

# JWKS keys are rotated periodically by Clerk. The cache must expire so we
# don't reject valid tokens signed with a freshly rotated key.
_JWKS_TTL_SECONDS = 3600
_JWKS_FETCH_TIMEOUT = 5.0

_jwks_cache: dict | None = None
_jwks_fetched_at: float = 0.0
_jwks_lock = asyncio.Lock()


def _reset_jwks_cache_for_tests() -> None:
    global _jwks_cache, _jwks_fetched_at
    _jwks_cache = None
    _jwks_fetched_at = 0.0


async def _fetch_jwks() -> dict:
    async with httpx.AsyncClient(timeout=_JWKS_FETCH_TIMEOUT) as client:
        r = await client.get(settings.CLERK_JWKS_URL)
        r.raise_for_status()
        return r.json()


async def _get_jwks(force_refresh: bool = False) -> dict:
    global _jwks_cache, _jwks_fetched_at

    def _fresh() -> bool:
        return (
            _jwks_cache is not None
            and (time.monotonic() - _jwks_fetched_at) < _JWKS_TTL_SECONDS
        )

    if not force_refresh and _fresh():
        return _jwks_cache  # type: ignore[return-value]

    async with _jwks_lock:
        if not force_refresh and _fresh():
            return _jwks_cache  # type: ignore[return-value]
        _jwks_cache = await _fetch_jwks()
        _jwks_fetched_at = time.monotonic()
        return _jwks_cache


def _kid_in_jwks(jwks: dict, kid: str | None) -> bool:
    if not kid:
        return False
    return any(k.get("kid") == kid for k in jwks.get("keys", []))


def _decode_dev(token: str) -> str:
    try:
        payload = jwt.decode(
            token,
            key="",
            options={"verify_signature": False},
        )
    except JWTError as e:
        logger.warning("Dev-mode token decode failed: %s", e)
        raise UnauthorizedException("Invalid token")
    user_id = payload.get("sub")
    if not user_id:
        raise UnauthorizedException("Invalid token")
    return user_id


async def _decode_verified(token: str) -> str:
    try:
        header = jwt.get_unverified_header(token)
    except JWTError as e:
        logger.warning("Failed to read JWT header: %s", e)
        raise UnauthorizedException("Invalid token")
    kid = header.get("kid")

    jwks = await _get_jwks()
    # Clerk key rotation: if the token's kid isn't in the cached JWKS,
    # refetch once and try again with the fresh set.
    if not _kid_in_jwks(jwks, kid):
        jwks = await _get_jwks(force_refresh=True)

    try:
        payload = jwt.decode(
            token,
            jwks,
            algorithms=["RS256"],
            audience=settings.CLERK_AUDIENCE or None,
            issuer=settings.CLERK_ISSUER or None,
            options={
                "verify_aud": bool(settings.CLERK_AUDIENCE),
                "verify_iss": bool(settings.CLERK_ISSUER),
            },
        )
    except JWTError as e:
        logger.warning("JWT verification failed: %s", e)
        raise UnauthorizedException("Invalid token")

    user_id = payload.get("sub")
    if not user_id:
        raise UnauthorizedException("Invalid token")
    return user_id


async def verify_clerk_token(
    credentials: HTTPAuthorizationCredentials | None = Security(_bearer),
) -> str:
    if credentials is None:
        raise UnauthorizedException("Missing authorization header")

    token = credentials.credentials

    if settings.AUTH_DEV_MODE:
        return _decode_dev(token)

    if not settings.CLERK_JWKS_URL:
        # Fail-closed: never silently bypass signature verification in
        # production. Operators must explicitly opt into AUTH_DEV_MODE.
        logger.error(
            "Auth misconfigured: AUTH_DEV_MODE is false and CLERK_JWKS_URL is empty"
        )
        raise UnauthorizedException("Auth not configured")

    return await _decode_verified(token)
