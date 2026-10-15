"""expand total user XP to 64 bits

Revision ID: d2e7c30b1a4f
Revises: 6a41d8f2c907
Create Date: 2026-10-15 12:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d2e7c30b1a4f"
down_revision: Union[str, Sequence[str], None] = "6a41d8f2c907"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("users") as batch_op:
        batch_op.alter_column(
            "xp",
            existing_type=sa.Integer(),
            type_=sa.BigInteger(),
            existing_nullable=False,
        )


def downgrade() -> None:
    connection = op.get_bind()
    xp_above_integer_range = connection.execute(
        sa.text("SELECT COUNT(*) FROM users WHERE xp > 2147483647 OR xp < -2147483648")
    ).scalar_one()
    if xp_above_integer_range:
        raise RuntimeError("Cannot downgrade while a user XP balance exceeds the 32-bit integer range")

    with op.batch_alter_table("users") as batch_op:
        batch_op.alter_column(
            "xp",
            existing_type=sa.BigInteger(),
            type_=sa.Integer(),
            existing_nullable=False,
        )
