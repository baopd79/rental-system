"""drop room.elec_rate column

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Branch Labels: None
Depends On: None

"""
from typing import Union, Sequence
import sqlalchemy as sa
from alembic import op

revision: str = 'e5f6a7b8c9d0'
down_revision: Union[str, Sequence[str], None] = 'd4e5f6a7b8c9'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_column("room", "elec_rate")


def downgrade() -> None:
    op.add_column("room", sa.Column("elec_rate", sa.Numeric(precision=10, scale=2), nullable=True))
