import pytest
import pytest_asyncio
from sqlalchemy import text
from app.database import engine
import app.core.clerk as clerk_module
from app.core.config import settings


@pytest.fixture(autouse=True)
def reset_jwks_cache():
    # Force dev mode in tests: skip real Clerk signature verification
    original = settings.CLERK_JWKS_URL
    settings.CLERK_JWKS_URL = ""
    clerk_module._jwks_cache = None
    yield
    settings.CLERK_JWKS_URL = original
    clerk_module._jwks_cache = None


@pytest_asyncio.fixture(autouse=True)
async def clean_db():
    """Truncate all tables before each test to ensure isolation."""
    yield
    async with engine.begin() as conn:
        await conn.execute(text(
            "TRUNCATE TABLE invoice_item, invoice, surcharge_template, utility_reading, "
            "contract, tenant, room, property RESTART IDENTITY CASCADE"
        ))
