"""store original study plan metadata for idempotent responses

Revision ID: b39e1c0a72d4
Revises: 7a2e9d4c1f63
Create Date: 2026-10-19 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b39e1c0a72d4"
down_revision: Union[str, Sequence[str], None] = "7a2e9d4c1f63"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("boss_fights") as batch_op:
        batch_op.add_column(sa.Column("plan_generated_from", sa.String(length=120), nullable=True))
        batch_op.add_column(sa.Column("plan_learning_objectives", sa.JSON(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("boss_fights") as batch_op:
        batch_op.drop_column("plan_learning_objectives")
        batch_op.drop_column("plan_generated_from")
