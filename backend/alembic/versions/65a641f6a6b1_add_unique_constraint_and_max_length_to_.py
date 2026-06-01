"""add unique constraint and max_length to surcharge_template.name

Revision ID: 65a641f6a6b1
Revises: 7fe9e659fa8e
Create Date: 2026-05-29 12:23:14.978798

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "65a641f6a6b1"
down_revision: Union[str, Sequence[str], None] = "7fe9e659fa8e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.alter_column(
        "surcharge_template",
        "name",
        existing_type=sa.String(),
        type_=sa.String(length=150),
        existing_nullable=False,
    )
    op.create_unique_constraint(
        "uq_surcharge_property_name", "surcharge_template", ["property_id", "name"]
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint(
        "uq_surcharge_property_name", "surcharge_template", type_="unique"
    )
    op.alter_column(
        "surcharge_template",
        "name",
        existing_type=sa.String(length=150),
        type_=sa.String(),
        existing_nullable=False,
    )
