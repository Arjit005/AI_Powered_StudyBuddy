"""Add session_artifacts table

Revision ID: 3a9c71b4e892
Revises: 284eaaba5e16
Create Date: 2026-11-19 22:38:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '3a9c71b4e892'
down_revision: Union[str, Sequence[str], None] = '284eaaba5e16'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    # Check if table already exists to allow idempotent application
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = inspector.get_table_names()

    if 'session_artifacts' not in tables:
        op.create_table(
            'session_artifacts',
            sa.Column('id', sa.String(length=36), primary_key=True, nullable=False),
            sa.Column('session_id', sa.Integer(), sa.ForeignKey('conversations.id', ondelete='CASCADE'), nullable=False),
            sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
            sa.Column('kind', sa.String(length=32), nullable=False),
            sa.Column('payload', sa.Text(), nullable=False),
            sa.Column('schema_version', sa.Integer(), nullable=False, server_default='1'),
            sa.Column('revision', sa.Integer(), nullable=False, server_default='1'),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
            sa.UniqueConstraint('session_id', 'user_id', 'kind', name='uq_session_user_kind')
        )
        op.create_index('ix_session_artifacts_session_id', 'session_artifacts', ['session_id'])
        op.create_index('ix_session_artifacts_user_id', 'session_artifacts', ['user_id'])
        op.create_index('ix_artifact_user_session', 'session_artifacts', ['user_id', 'session_id'])

def downgrade() -> None:
    op.drop_table('session_artifacts')
