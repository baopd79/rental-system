import os

os.environ["DATABASE_URL"] = (
    "postgresql+asyncpg://postgres:postgres@localhost:5432/rental_test_db"
)

import pytest
import pytest_asyncio
from sqlalchemy import text

import app.core.clerk as clerk_module
from app.core.config import settings
from app.core.database import engine

TRUNCATE_SQL = """
TRUNCATE TABLE
    contract_event,
    shared_meter_reading,
    shared_meter_room,
    shared_meter,
    invoice_item,
    invoice,
    surcharge_template,
    utility_reading,
    contract,
    tenant,
    room,
    property
RESTART IDENTITY CASCADE
"""


async def truncate_db():
    async with engine.begin() as conn:
        await conn.execute(text(TRUNCATE_SQL))


@pytest.fixture(autouse=True)
def reset_auth_state():
    original_dev_mode = settings.AUTH_DEV_MODE
    original_jwks_url = settings.CLERK_JWKS_URL
    original_issuer = settings.CLERK_ISSUER
    original_audience = settings.CLERK_AUDIENCE

    settings.AUTH_DEV_MODE = True
    settings.CLERK_JWKS_URL = ""
    settings.CLERK_ISSUER = ""
    settings.CLERK_AUDIENCE = ""
    clerk_module._reset_jwks_cache_for_tests()

    yield

    settings.AUTH_DEV_MODE = original_dev_mode
    settings.CLERK_JWKS_URL = original_jwks_url
    settings.CLERK_ISSUER = original_issuer
    settings.CLERK_AUDIENCE = original_audience
    clerk_module._reset_jwks_cache_for_tests()


@pytest_asyncio.fixture(autouse=True)
async def clean_db():
    await truncate_db()
    yield
    await truncate_db()
