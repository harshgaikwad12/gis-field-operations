from decimal import Decimal

from sqlalchemy import Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class PendingConsumer(Base):
    __tablename__ = "pending_consumers"

    id: Mapped[int] = mapped_column(
        primary_key=True,
    )

    consumer_id: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        unique=True,
        index=True,
    )

    consumer_name: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
        index=True,
    )

    meter_id: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        index=True,
    )

    pending_amount: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False,
    )

    days_pending: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )