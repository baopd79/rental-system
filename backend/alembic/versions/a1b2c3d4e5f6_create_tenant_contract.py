"""create tenant and contract tables

Revision ID: a1b2c3d4e5f6
Revises: 48d0bd101bc5
Create Date: 2026-05-17

"""

from typing import Union, Sequence
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ENUM as PgEnum
from alembic import op

revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, Sequence[str], None] = "48d0bd101bc5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "tenant",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("clerk_user_id", sa.String(), nullable=False),
        sa.Column("full_name", sa.String(), nullable=False),
        sa.Column("cccd", sa.String(), nullable=True),
        sa.Column("phone", sa.String(), nullable=True),
        sa.Column("email", sa.String(), nullable=True),
        sa.Column("date_of_birth", sa.Date(), nullable=True),
    )
    op.create_index("ix_tenant_clerk_user_id", "tenant", ["clerk_user_id"])

    # Create enum type first, then table — PgEnum(create_type=False) prevents
    # create_table from auto-issuing a second CREATE TYPE statement
    contractstatus = PgEnum("active", "ended", name="contractstatus")
    contractstatus.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "contract",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("room_id", sa.Integer(), sa.ForeignKey("room.id"), nullable=False),
        sa.Column(
            "tenant_id", sa.Integer(), sa.ForeignKey("tenant.id"), nullable=False
        ),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        sa.Column("agreed_rent", sa.Numeric(precision=12, scale=0), nullable=False),
        sa.Column(
            "deposit",
            sa.Numeric(precision=12, scale=0),
            nullable=False,
            server_default="0",
        ),
        sa.Column("num_people", sa.Integer(), nullable=False, server_default="1"),
        sa.Column(
            "status",
            PgEnum("active", "ended", name="contractstatus", create_type=False),
            nullable=False,
            server_default="active",
        ),
    )
    op.create_index("ix_contract_room_id", "contract", ["room_id"])
    op.create_index("ix_contract_tenant_id", "contract", ["tenant_id"])


def downgrade() -> None:
    op.drop_index("ix_contract_tenant_id", "contract")
    op.drop_index("ix_contract_room_id", "contract")
    op.drop_table("contract")
    PgEnum(name="contractstatus").drop(op.get_bind(), checkfirst=True)

    op.drop_index("ix_tenant_clerk_user_id", "tenant")
    op.drop_table("tenant")
