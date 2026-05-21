"""create shared_meter tables and add shared_elec invoice item type

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-05-18

"""
from typing import Union, Sequence
import sqlalchemy as sa
from alembic import op

revision: str = 'f6a7b8c9d0e1'
down_revision: Union[str, Sequence[str], None] = 'e5f6a7b8c9d0'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ALTER TYPE ... ADD VALUE cannot run inside a transaction block.
    # autocommit_block() commits the current transaction, runs the statement
    # outside any transaction, then opens a new transaction for the remaining DDL.
    with op.get_context().autocommit_block():
        op.execute(sa.text("ALTER TYPE invoiceitemtype ADD VALUE IF NOT EXISTS 'shared_elec'"))

    op.create_table(
        "shared_meter",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("property_id", sa.Integer(), sa.ForeignKey("property.id"), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
    )
    op.create_index("ix_shared_meter_property_id", "shared_meter", ["property_id"])

    op.create_table(
        "shared_meter_room",
        sa.Column("shared_meter_id", sa.Integer(), sa.ForeignKey("shared_meter.id"), primary_key=True),
        sa.Column("room_id", sa.Integer(), sa.ForeignKey("room.id"), primary_key=True),
    )

    op.create_table(
        "shared_meter_reading",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("shared_meter_id", sa.Integer(), sa.ForeignKey("shared_meter.id"), nullable=False),
        sa.Column("period", sa.String(7), nullable=False),
        sa.Column("prev_reading", sa.Numeric(precision=12, scale=2), nullable=True),
        sa.Column("curr_reading", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("is_prev_auto", sa.Boolean(), nullable=False, server_default="true"),
    )
    op.create_index("ix_shared_meter_reading_meter_id", "shared_meter_reading", ["shared_meter_id"])
    op.create_unique_constraint(
        "uq_shared_meter_reading_meter_period",
        "shared_meter_reading",
        ["shared_meter_id", "period"],
    )


def downgrade() -> None:
    op.drop_table("shared_meter_reading")
    op.drop_table("shared_meter_room")
    op.drop_table("shared_meter")
    # Note: PostgreSQL does not support removing enum values — shared_elec stays
