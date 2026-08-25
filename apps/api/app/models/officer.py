from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Officer(Base):
    __tablename__ = "officers"

    id: Mapped[int] = mapped_column(
        primary_key=True,
    )

    officer_code: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        unique=True,
        index=True,
    )

    officer_name: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
    )

    email: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        unique=True,
        index=True,
    )

    phone: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        unique=True,
        index=True,
    )

    role: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        server_default=text("true"),
    )

    password_hash: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    zone_id: Mapped[int | None] = mapped_column(
        ForeignKey(
            "zones.id",
            ondelete="RESTRICT",
        ),
        nullable=True,
        index=True,
    )

    area_id: Mapped[int | None] = mapped_column(
        ForeignKey(
            "areas.id",
            ondelete="RESTRICT",
        ),
        nullable=True,
        index=True,
    )

    field_area_id: Mapped[int | None] = mapped_column(
        ForeignKey(
            "field_areas.id",
            ondelete="RESTRICT",
        ),
        nullable=True,
        index=True,
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
        foreign_keys=[zone_id],
    )

    area = relationship(
        "Area",
        foreign_keys=[area_id],
    )

    field_area = relationship(
        "FieldArea",
        foreign_keys=[field_area_id],
    )