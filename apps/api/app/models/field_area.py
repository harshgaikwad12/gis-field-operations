from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class FieldArea(Base):
    __tablename__ = "field_areas"

    id: Mapped[int] = mapped_column(
        primary_key=True,
    )

    field_area_code: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        unique=True,
        index=True,
    )

    field_area_name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        index=True,
    )

    area_id: Mapped[int] = mapped_column(
        ForeignKey(
            "areas.id",
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

    area = relationship(
        "Area",
        back_populates="field_areas",
    )