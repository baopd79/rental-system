"""add bank fields to property

Revision ID: e27f095a9cf0
Revises: f6a7b8c9d0e1
Create Date: 2026-05-18 22:40:48.682754

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision: str = "e27f095a9cf0"
down_revision: Union[str, Sequence[str], None] = "f6a7b8c9d0e1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint(op.f("uq_invoice_contract_period"), "invoice", type_="unique")
    op.drop_index(op.f("ix_invoice_public_token"), table_name="invoice")
    op.create_index(
        op.f("ix_invoice_public_token"), "invoice", ["public_token"], unique=False
    )
    op.add_column(
        "property",
        sa.Column("bank_account_no", sqlmodel.AutoString(length=30), nullable=True),
    )
    op.add_column(
        "property",
        sa.Column("bank_name", sqlmodel.AutoString(length=100), nullable=True),
    )
    op.add_column(
        "property",
        sa.Column("bank_holder", sqlmodel.AutoString(length=100), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("property", "bank_holder")
    op.drop_column("property", "bank_name")
    op.drop_column("property", "bank_account_no")
    op.drop_index(op.f("ix_invoice_public_token"), table_name="invoice")
    op.create_index(
        op.f("ix_invoice_public_token"), "invoice", ["public_token"], unique=True
    )
    op.create_unique_constraint(
        op.f("uq_invoice_contract_period"), "invoice", ["contract_id", "period"]
    )
