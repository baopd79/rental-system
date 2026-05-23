"""add payment_reported_at to invoice

Revision ID: 055f20ea142d
Revises: e27f095a9cf0
Create Date: 2026-05-18 23:11:28.685728

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "055f20ea142d"
down_revision: Union[str, Sequence[str], None] = "e27f095a9cf0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "invoice", sa.Column("payment_reported_at", sa.DateTime(), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("invoice", "payment_reported_at")
