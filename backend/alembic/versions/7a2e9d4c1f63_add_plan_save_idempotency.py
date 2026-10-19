"""add study plan save idempotency key

Revision ID: 7a2e9d4c1f63
Revises: ab4c9e71d203
Create Date: 2026-10-19 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "7a2e9d4c1f63"
down_revision: Union[str, Sequence[str], None] = "ab4c9e71d203"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("boss_fights") as batch_op:
        batch_op.add_column(sa.Column("plan_id", sa.String(length=36), nullable=True))
        batch_op.create_unique_constraint(
            "uq_boss_fights_user_plan_id",
            ["user_id", "plan_id"],
        )


def downgrade() -> None:
    with op.batch_alter_table("boss_fights") as batch_op:
        batch_op.drop_constraint("uq_boss_fights_user_plan_id", type_="unique")
        batch_op.drop_column("plan_id")
