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
def reset_jwks_cache():
    original = settings.CLERK_JWKS_URL
    settings.CLERK_JWKS_URL = ""
    clerk_module._jwks_cache = None

    yield

    settings.CLERK_JWKS_URL = original
    clerk_module._jwks_cache = None


@pytest_asyncio.fixture(autouse=True)
async def clean_db():
    await truncate_db()
    yield
    await truncate_db()
