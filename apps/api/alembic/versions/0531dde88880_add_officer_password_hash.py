"""add officer password hash

Revision ID: 0531dde88880
Revises: fbc248d9e8de
Create Date: 2026-08-18 16:40:18.641386

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0531dde88880"
down_revision: Union[str, Sequence[str], None] = "fbc248d9e8de"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""

    op.add_column(
        "officers",
        sa.Column(
            "password_hash",
            sa.String(length=255),
            nullable=True,
        ),
    )

    op.alter_column(
        "officers",
        "password_hash",
        nullable=False,
    )


def downgrade() -> None:
    """Downgrade schema."""

    op.drop_column(
        "officers",
        "password_hash",
    )