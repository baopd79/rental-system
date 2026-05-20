"""create utility_reading table

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-05-17

"""
from typing import Union, Sequence
import sqlalchemy as sa
from alembic import op

revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, Sequence[str], None] = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "utility_reading",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("room_id", sa.Integer(), sa.ForeignKey("room.id"), nullable=False),
        sa.Column("period", sa.String(7), nullable=False),
        sa.Column("elec_prev", sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column("elec_curr", sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column("water_prev", sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column("water_curr", sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column("is_prev_auto", sa.Boolean(), nullable=False, server_default="true"),
    )
    op.create_index("ix_utility_reading_room_id", "utility_reading", ["room_id"])
    op.create_unique_constraint(
        "uq_utility_reading_room_period", "utility_reading", ["room_id", "period"]
    )


def downgrade() -> None:
    op.drop_constraint("uq_utility_reading_room_period", "utility_reading", type_="unique")
    op.drop_index("ix_utility_reading_room_id", "utility_reading")
    op.drop_table("utility_reading")
