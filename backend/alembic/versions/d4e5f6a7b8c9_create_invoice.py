"""create invoice and invoice_item tables

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-05-17

"""
from typing import Union, Sequence
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ENUM as PgEnum
from alembic import op

revision: str = 'd4e5f6a7b8c9'
down_revision: Union[str, Sequence[str], None] = 'c3d4e5f6a7b8'
branch_labels = None
depends_on = None


def upgrade() -> None:
    invoicestatus = PgEnum("draft", "sent", "paid", name="invoicestatus")
    invoicestatus.create(op.get_bind(), checkfirst=True)

    invoiceitemtype = PgEnum("rent", "electricity", "water", "surcharge", name="invoiceitemtype")
    invoiceitemtype.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "invoice",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("contract_id", sa.Integer(), sa.ForeignKey("contract.id"), nullable=False),
        sa.Column("period", sa.String(7), nullable=False),
        sa.Column("total", sa.Numeric(precision=14, scale=0), nullable=False),
        sa.Column("status", PgEnum("draft", "sent", "paid", name="invoicestatus", create_type=False), nullable=False, server_default="draft"),
        sa.Column("public_token", sa.String(), nullable=False),
    )
    op.create_index("ix_invoice_contract_id", "invoice", ["contract_id"])
    op.create_index("ix_invoice_public_token", "invoice", ["public_token"], unique=True)
    op.create_unique_constraint("uq_invoice_contract_period", "invoice", ["contract_id", "period"])

    op.create_table(
        "invoice_item",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("invoice_id", sa.Integer(), sa.ForeignKey("invoice.id"), nullable=False),
        sa.Column("item_type", PgEnum("rent", "electricity", "water", "surcharge", name="invoiceitemtype", create_type=False), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("unit_price", sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column("quantity", sa.Numeric(precision=10, scale=2), nullable=False, server_default="1"),
        sa.Column("amount", sa.Numeric(precision=14, scale=0), nullable=False),
    )
    op.create_index("ix_invoice_item_invoice_id", "invoice_item", ["invoice_id"])


def downgrade() -> None:
    op.drop_index("ix_invoice_item_invoice_id", "invoice_item")
    op.drop_table("invoice_item")

    op.drop_constraint("uq_invoice_contract_period", "invoice", type_="unique")
    op.drop_index("ix_invoice_public_token", "invoice")
    op.drop_index("ix_invoice_contract_id", "invoice")
    op.drop_table("invoice")

    PgEnum(name="invoiceitemtype").drop(op.get_bind(), checkfirst=True)
    PgEnum(name="invoicestatus").drop(op.get_bind(), checkfirst=True)
