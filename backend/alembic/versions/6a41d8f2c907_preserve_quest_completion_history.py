"""preserve completion history when deleting quests

Revision ID: 6a41d8f2c907
Revises: c1fa900290bb
Create Date: 2026-10-15 12:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "6a41d8f2c907"
down_revision: Union[str, Sequence[str], None] = "c1fa900290bb"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


FOREIGN_KEY_NAME = "fk_quest_completions_quest_id_quests"


def upgrade() -> None:
    with op.batch_alter_table("quest_completions") as batch_op:
        batch_op.drop_constraint(FOREIGN_KEY_NAME, type_="foreignkey")
        batch_op.alter_column(
            "quest_id",
            existing_type=sa.Integer(),
            nullable=True,
        )
        batch_op.create_foreign_key(
            FOREIGN_KEY_NAME,
            "quests",
            ["quest_id"],
            ["id"],
            ondelete="SET NULL",
        )


def downgrade() -> None:
    connection = op.get_bind()
    orphaned_completions = connection.execute(
        sa.text("SELECT COUNT(*) FROM quest_completions WHERE quest_id IS NULL")
    ).scalar_one()
    if orphaned_completions:
        raise RuntimeError(
            "Cannot downgrade while quest completion history exists without its deleted quest"
        )

    with op.batch_alter_table("quest_completions") as batch_op:
        batch_op.drop_constraint(FOREIGN_KEY_NAME, type_="foreignkey")
        batch_op.alter_column(
            "quest_id",
            existing_type=sa.Integer(),
            nullable=False,
        )
        batch_op.create_foreign_key(
            FOREIGN_KEY_NAME,
            "quests",
            ["quest_id"],
            ["id"],
            ondelete="CASCADE",
        )

