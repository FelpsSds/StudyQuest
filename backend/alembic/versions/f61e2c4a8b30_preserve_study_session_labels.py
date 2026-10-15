"""preserve study session labels after related records are deleted

Revision ID: f61e2c4a8b30
Revises: e3057dd8865b
Create Date: 2026-10-15 12:30:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f61e2c4a8b30"
down_revision: Union[str, Sequence[str], None] = "e3057dd8865b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("study_sessions") as batch_op:
        batch_op.add_column(sa.Column("subject_name", sa.String(length=120), nullable=True))
        batch_op.add_column(sa.Column("quest_title", sa.String(length=200), nullable=True))

    connection = op.get_bind()
    connection.execute(sa.text(
        "UPDATE study_sessions SET subject_name = "
        "(SELECT subjects.name FROM subjects WHERE subjects.id = study_sessions.subject_id) "
        "WHERE subject_id IS NOT NULL"
    ))
    connection.execute(sa.text(
        "UPDATE study_sessions SET quest_title = "
        "(SELECT quests.title FROM quests WHERE quests.id = study_sessions.quest_id) "
        "WHERE quest_id IS NOT NULL"
    ))


def downgrade() -> None:
    with op.batch_alter_table("study_sessions") as batch_op:
        batch_op.drop_column("quest_title")
        batch_op.drop_column("subject_name")
