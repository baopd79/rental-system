"""add contract_id to utility_reading and create contract_event table

Revision ID: a7b8c9d0e1f2
Revises: 055f20ea142d
Create Date: 2026-05-19

"""

from typing import Union, Sequence
import sqlalchemy as sa
from alembic import op

revision: str = "a7b8c9d0e1f2"
down_revision: Union[str, Sequence[str], None] = "055f20ea142d"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add contract_id to utility_reading
    op.add_column(
        "utility_reading",
        sa.Column(
            "contract_id",
            sa.Integer(),
            sa.ForeignKey("contract.id"),
            nullable=True,
            index=True,
        ),
    )

    # Backfill: link each reading to the contract that was active during that month.
    # Matches on room_id + period string comparison (YYYY-MM ordering is lexicographic-safe).
    op.execute("""
        UPDATE utility_reading ur
        SET contract_id = (
            SELECT c.id
            FROM contract c
            WHERE c.room_id = ur.room_id
              AND to_char(c.start_date, 'YYYY-MM') <= ur.period
              AND to_char(c.end_date,   'YYYY-MM') >= ur.period
            ORDER BY c.start_date DESC
            LIMIT 1
        )
    """)

    # Create contract_event table
    op.create_table(
        "contract_event",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "contract_id",
            sa.Integer(),
            sa.ForeignKey("contract.id"),
            nullable=False,
            index=True,
        ),
        sa.Column("event_type", sa.String(30), nullable=False),
        sa.Column("old_value", sa.String(200), nullable=True),
        sa.Column("new_value", sa.String(200), nullable=True),
        sa.Column("occurred_at", sa.DateTime(), nullable=False),
    )

    # Backfill creation events for existing contracts
    op.execute("""
        INSERT INTO contract_event (contract_id, event_type, new_value, occurred_at)
        SELECT id, 'created', agreed_rent::text, start_date::timestamp
        FROM contract
    """)


def downgrade() -> None:
    op.drop_table("contract_event")
    op.drop_column("utility_reading", "contract_id")
