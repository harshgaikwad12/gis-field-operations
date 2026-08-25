from datetime import datetime, timezone

from geoalchemy2.elements import WKTElement
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.area import Area
from app.models.field_area import FieldArea
from app.models.master_meter import MasterMeter
from app.models.zone import Zone


class MasterMeterStorageError(Exception):
    """Base exception for master-meter storage operations."""


class MasterMeterNotFoundError(MasterMeterStorageError):
    """Raised when a master meter does not exist."""


class MasterMeterGeographyError(MasterMeterStorageError):
    """Raised when geographical assignment is invalid."""


def get_master_meter_by_id(
    db: Session,
    meter_pk: int,
) -> MasterMeter | None:
    return db.get(
        MasterMeter,
        meter_pk,
    )


def get_master_meter_by_meter_id(
    db: Session,
    meter_id: str,
) -> MasterMeter | None:
    stmt = select(MasterMeter).where(
        MasterMeter.meter_id == meter_id
    )

    return db.execute(stmt).scalar_one_or_none()


def assign_master_meter_geography(
    db: Session,
    *,
    meter_id: str,
    zone_id: int,
    area_id: int,
    field_area_id: int,
) -> MasterMeter:
    meter = get_master_meter_by_meter_id(
        db,
        meter_id.strip(),
    )

    if meter is None:
        raise MasterMeterNotFoundError(
            "Master meter not found."
        )

    zone = db.get(
        Zone,
        zone_id,
    )

    if zone is None or not zone.is_active:
        raise MasterMeterGeographyError(
            "Zone does not exist or is inactive."
        )

    area = db.get(
        Area,
        area_id,
    )

    if area is None or not area.is_active:
        raise MasterMeterGeographyError(
            "Area does not exist or is inactive."
        )

    if area.zone_id != zone_id:
        raise MasterMeterGeographyError(
            "Area does not belong to the specified zone."
        )

    field_area = db.get(
        FieldArea,
        field_area_id,
    )

    if field_area is None or not field_area.is_active:
        raise MasterMeterGeographyError(
            "Field area does not exist or is inactive."
        )

    if field_area.area_id != area_id:
        raise MasterMeterGeographyError(
            "Field area does not belong to the specified area."
        )

    meter.zone_id = zone_id
    meter.area_id = area_id
    meter.field_area_id = field_area_id
    meter.updated_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(meter)

    return meter


def list_master_meters_for_zone(
    db: Session,
    *,
    zone_id: int,
) -> list[MasterMeter]:
    stmt = (
        select(MasterMeter)
        .where(
            MasterMeter.zone_id == zone_id
        )
        .order_by(MasterMeter.id)
    )

    return list(
        db.execute(stmt).scalars().all()
    )


def list_master_meters_for_area(
    db: Session,
    *,
    zone_id: int,
    area_id: int,
) -> list[MasterMeter]:
    stmt = (
        select(MasterMeter)
        .where(
            MasterMeter.zone_id == zone_id,
            MasterMeter.area_id == area_id,
        )
        .order_by(MasterMeter.id)
    )

    return list(
        db.execute(stmt).scalars().all()
    )


def list_master_meters_for_field_area(
    db: Session,
    *,
    zone_id: int,
    area_id: int,
    field_area_id: int,
) -> list[MasterMeter]:
    stmt = (
        select(MasterMeter)
        .where(
            MasterMeter.zone_id == zone_id,
            MasterMeter.area_id == area_id,
            MasterMeter.field_area_id == field_area_id,
        )
        .order_by(MasterMeter.id)
    )

    return list(
        db.execute(stmt).scalars().all()
    )


def upsert_master_meters(
    db: Session,
    rows: list[dict[str, str]],
    zone_id: int | None = None,
) -> dict[str, int]:
    inserted = 0
    updated = 0

    meter_ids = [
        row["meter_id"].strip()
        for row in rows
    ]

    existing_meters = {
        meter.meter_id: meter
        for meter in db.scalars(
            select(MasterMeter).where(
                MasterMeter.meter_id.in_(meter_ids)
            )
        ).all()
    }

    now = datetime.now(timezone.utc)

    for row in rows:
        meter_id = row["meter_id"].strip()

        customer_id = row["customer_id"].strip()
        customer_name = row["customer_name"].strip()

        latitude = float(
            row["latitude"].strip()
        )

        longitude = float(
            row["longitude"].strip()
        )

        location = WKTElement(
            f"POINT({longitude} {latitude})",
            srid=4326,
        )

        existing = existing_meters.get(
            meter_id
        )

        if existing:
            existing.customer_id = customer_id
            existing.customer_name = customer_name
            existing.location = location
            if zone_id is not None:
                existing.zone_id = zone_id
            existing.updated_at = now

            updated += 1

        else:
            meter = MasterMeter(
                meter_id=meter_id,
                customer_id=customer_id,
                customer_name=customer_name,
                location=location,
                zone_id=zone_id,
                created_at=now,
                updated_at=now,
            )

            db.add(meter)
            inserted += 1

    db.commit()

    return {
        "inserted": inserted,
        "updated": updated,
        "total": inserted + updated,
    }


# ============================================================
# SCOPE-AWARE MASTER METER QUERIES
# ============================================================

from app.core.scope import OfficerScope


def list_master_meters_for_scope(
    db: Session,
    *,
    scope: OfficerScope,
) -> list[MasterMeter]:
    """
    Return only master meters visible within the officer's
    geographical scope.

    ADMIN:
        zone only

    AREA_ADMIN:
        zone + area

    FIELD_OFFICER:
        zone + area + field area
    """

    stmt = select(MasterMeter).where(
        MasterMeter.zone_id == scope.zone_id
    )

    if scope.area_id is not None:
        stmt = stmt.where(
            MasterMeter.area_id == scope.area_id
        )

    if scope.field_area_id is not None:
        stmt = stmt.where(
            MasterMeter.field_area_id
            == scope.field_area_id
        )

    stmt = stmt.order_by(
        MasterMeter.id
    )

    return list(
        db.execute(stmt).scalars().all()
    )
