import asyncio
from logging.config import fileConfig

from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import create_async_engine
from sqlmodel import SQLModel

from alembic import context
from app.core.config import settings

# import all models so SQLModel.metadata is populated
import app.models  # noqa: F401

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = SQLModel.metadata

# Tables managed by SQLModel models — autogenerate only touches these.
# Any table in the DB that isn't in this set is ignored (no DROP generated).
_MANAGED_TABLES = {m.name for m in target_metadata.sorted_tables}


def include_object(object, name, type_, reflected, compare_to):
    """
    Guard against autogenerate producing DROP TABLE / DROP COLUMN for objects
    that exist in the DB but are absent from the current migration chain snapshot.
    This happens when `alembic stamp` is used to bypass revisions.

    Rules:
    - Tables: only include tables that are declared in SQLModel metadata.
      Reflected-only tables (exist in DB, not in models) are skipped silently.
    - Everything else (columns, indexes, constraints): always include so column
      additions/changes are still detected normally.
    """
    if type_ == "table":
        return name in _MANAGED_TABLES
    return True


def run_migrations_offline() -> None:
    url = settings.DATABASE_URL
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        include_object=include_object,
        user_module_prefix="sqlmodel.",
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        user_module_prefix="sqlmodel.",
        include_object=include_object,
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    connectable = create_async_engine(settings.DATABASE_URL, poolclass=pool.NullPool)
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
