"""expand user levels to 64 bits

Revision ID: ab4c9e71d203
Revises: f61e2c4a8b30
Create Date: 2026-10-19 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "ab4c9e71d203"
down_revision: Union[str, Sequence[str], None] = "f61e2c4a8b30"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("users") as batch_op:
        batch_op.alter_column(
            "level",
            existing_type=sa.Integer(),
            type_=sa.BigInteger(),
            existing_nullable=False,
        )


def downgrade() -> None:
    connection = op.get_bind()
    levels_above_integer_range = connection.execute(
        sa.text("SELECT COUNT(*) FROM users WHERE level > 2147483647 OR level < -2147483648")
    ).scalar_one()
    if levels_above_integer_range:
        raise RuntimeError("Cannot downgrade while a user level exceeds the 32-bit integer range")

    with op.batch_alter_table("users") as batch_op:
        batch_op.alter_column(
            "level",
            existing_type=sa.BigInteger(),
            type_=sa.Integer(),
            existing_nullable=False,
        )
