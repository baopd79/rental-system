import httpx
from fastapi import Security
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from app.core.config import settings
from app.core.exceptions import UnauthorizedException

_bearer = HTTPBearer(auto_error=False)
_jwks_cache: dict | None = None


async def _get_jwks() -> dict:
    global _jwks_cache
    if _jwks_cache is None:
        async with httpx.AsyncClient() as client:
            r = await client.get(settings.CLERK_JWKS_URL)
            r.raise_for_status()
            _jwks_cache = r.json()
    return _jwks_cache


async def verify_clerk_token(
    credentials: HTTPAuthorizationCredentials | None = Security(_bearer),
) -> str:
    if credentials is None:
        raise UnauthorizedException("Missing authorization header")

    token = credentials.credentials

    # Dev mode: skip JWKS when CLERK_JWKS_URL is not set
    if not settings.CLERK_JWKS_URL:
        try:
            payload = jwt.decode(
                token,
                key="",
                algorithms=["HS256", "RS256"],
                options={"verify_signature": False},
            )
            user_id: str | None = payload.get("sub")
            if not user_id:
                raise UnauthorizedException("Invalid token: missing sub")
            return user_id
        except JWTError as e:
            raise UnauthorizedException(f"Invalid token: {e}")

    try:
        jwks = await _get_jwks()
        payload = jwt.decode(
            token,
            jwks,
            algorithms=["RS256"],
            audience=settings.CLERK_AUDIENCE or None,
            options={"verify_aud": bool(settings.CLERK_AUDIENCE)},
        )
        user_id = payload.get("sub")
        if not user_id:
            raise UnauthorizedException("Invalid token: missing sub")
        return user_id
    except JWTError as e:
        raise UnauthorizedException(f"Invalid token: {e}")
