"""create surcharge_template table

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-05-17

"""
from typing import Union, Sequence
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ENUM as PgEnum
from alembic import op

revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, Sequence[str], None] = 'b2c3d4e5f6a7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    surchargecalctype = PgEnum("per_room", "per_person", name="surchargecalctype")
    surchargecalctype.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "surcharge_template",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("property_id", sa.Integer(), sa.ForeignKey("property.id"), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("calc_type", PgEnum("per_room", "per_person", name="surchargecalctype", create_type=False), nullable=False),
        sa.Column("amount", sa.Numeric(precision=12, scale=0), nullable=False),
    )
    op.create_index("ix_surcharge_template_property_id", "surcharge_template", ["property_id"])


def downgrade() -> None:
    op.drop_index("ix_surcharge_template_property_id", "surcharge_template")
    op.drop_table("surcharge_template")
    PgEnum(name="surchargecalctype").drop(op.get_bind(), checkfirst=True)
