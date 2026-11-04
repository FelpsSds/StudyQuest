"""link quests to boss fights

Revision ID: 52bd00f4a2c7
Revises: 63db38ddd340
Create Date: 2026-09-25 10:27:25.214297
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '52bd00f4a2c7'
down_revision: Union[str, Sequence[str], None] = '63db38ddd340'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("quests") as batch_op:
        batch_op.add_column(sa.Column("boss_fight_id", sa.Integer(), nullable=True))
        batch_op.create_index(op.f("ix_quests_boss_fight_id"), ["boss_fight_id"], unique=False)
        batch_op.create_foreign_key(
            op.f("fk_quests_boss_fight_id_boss_fights"),
            "boss_fights",
            ["boss_fight_id"],
            ["id"],
            ondelete="SET NULL",
        )


def downgrade() -> None:
    with op.batch_alter_table("quests") as batch_op:
        batch_op.drop_constraint(op.f("fk_quests_boss_fight_id_boss_fights"), type_="foreignkey")
        batch_op.drop_index(op.f("ix_quests_boss_fight_id"))
        batch_op.drop_column("boss_fight_id")
