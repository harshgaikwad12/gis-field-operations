"""Baseline existing database schema."""

from alembic import op


revision = "49ae286a3763"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Mark the existing database schema as the baseline."""
    pass


def downgrade() -> None:
    """Baseline has no automatic downgrade."""
    pass