from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Area(Base):
    __tablename__ = "areas"

    id: Mapped[int] = mapped_column(
        primary_key=True,
    )

    area_code: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        unique=True,
        index=True,
    )

    area_name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        index=True,
    )

    zone_id: Mapped[int] = mapped_column(
        ForeignKey(
            "zones.id",
            ondelete="RESTRICT",
        ),
        nullable=False,
        index=True,
    )

    is_active: Mapped[bool] = mapped_column(
        nullable=False,
        server_default=text("true"),
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=text("now()"),
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=text("now()"),
    )

    zone = relationship(
        "Zone",
        back_populates="areas",
    )

    field_areas = relationship(
        "FieldArea",
        back_populates="area",
        cascade="all, delete-orphan",
    )