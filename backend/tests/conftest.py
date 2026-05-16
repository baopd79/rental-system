import pytest
import pytest_asyncio
from sqlalchemy import text
from app.database import engine
import app.core.clerk as clerk_module


@pytest.fixture(autouse=True)
def reset_jwks_cache():
    clerk_module._jwks_cache = None
    yield
    clerk_module._jwks_cache = None


@pytest_asyncio.fixture(autouse=True)
async def clean_db():
    """Truncate all tables before each test to ensure isolation."""
    yield
    async with engine.begin() as conn:
        await conn.execute(text("TRUNCATE TABLE property RESTART IDENTITY CASCADE"))
