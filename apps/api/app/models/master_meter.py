from datetime import datetime

from geoalchemy2 import Geometry
from sqlalchemy import BigInteger, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class MasterMeter(Base):
    __tablename__ = "master_meters"

    id: Mapped[int] = mapped_column(
        BigInteger,
        primary_key=True,
    )

    meter_id: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        unique=True,
        index=True,
    )

    customer_id: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        index=True,
    )

    customer_name: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
        index=True,
    )

    location: Mapped[str] = mapped_column(
        Geometry(
            geometry_type="POINT",
            srid=4326,
        ),
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
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )
