"""expand XP transaction reason to fit maximum quest titles

Revision ID: e3057dd8865b
Revises: d2e7c30b1a4f
Create Date: 2026-10-15 12:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e3057dd8865b"
down_revision: Union[str, Sequence[str], None] = "d2e7c30b1a4f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("xp_transactions") as batch_op:
        batch_op.alter_column(
            "reason",
            existing_type=sa.String(length=200),
            type_=sa.String(length=255),
            existing_nullable=False,
        )


def downgrade() -> None:
    connection = op.get_bind()
    reasons_above_limit = connection.execute(
        sa.text("SELECT COUNT(*) FROM xp_transactions WHERE LENGTH(reason) > 200")
    ).scalar_one()
    if reasons_above_limit:
        raise RuntimeError("Cannot downgrade while XP transaction reasons exceed 200 characters")

    with op.batch_alter_table("xp_transactions") as batch_op:
        batch_op.alter_column(
            "reason",
            existing_type=sa.String(length=255),
            type_=sa.String(length=200),
            existing_nullable=False,
        )
