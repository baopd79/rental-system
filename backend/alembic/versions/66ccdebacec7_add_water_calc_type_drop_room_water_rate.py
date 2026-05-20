"""add_water_calc_type_drop_room_water_rate

Revision ID: 66ccdebacec7
Revises: 2b185c5743d9
Create Date: 2026-05-17 03:46:59.749188

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision: str = '66ccdebacec7'
down_revision: Union[str, Sequence[str], None] = '2b185c5743d9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


watercalctype = sa.Enum('per_meter', 'per_person', 'per_room', name='watercalctype')


def upgrade() -> None:
    """Upgrade schema."""
    watercalctype.create(op.get_bind(), checkfirst=True)
    op.add_column('property', sa.Column('water_calc_type', watercalctype, server_default='per_meter', nullable=False))
    op.drop_column('room', 'water_rate')


def downgrade() -> None:
    """Downgrade schema."""
    op.add_column('room', sa.Column('water_rate', sa.NUMERIC(precision=10, scale=2), autoincrement=False, nullable=True))
    op.drop_column('property', 'water_calc_type')
    watercalctype.drop(op.get_bind(), checkfirst=True)
