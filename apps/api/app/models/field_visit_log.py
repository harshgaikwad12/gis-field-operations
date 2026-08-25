from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class FieldVisitLog(Base):
    __tablename__ = "field_visit_logs"

    id: Mapped[int] = mapped_column(
        primary_key=True,
    )

    consumer_id: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        index=True,
    )

    meter_id: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        index=True,
    )

    officer_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("officers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    field_area_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("field_areas.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    status: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
    )

    amount_collected: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        default=Decimal("0.00"),
        nullable=False,
    )

    notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    latitude: Mapped[float | None] = mapped_column(
        Numeric(10, 6),
        nullable=True,
    )

    longitude: Mapped[float | None] = mapped_column(
        Numeric(10, 6),
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True,
    )
