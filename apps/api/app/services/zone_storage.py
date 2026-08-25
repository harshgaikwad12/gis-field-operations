from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.zone import Zone


class ZoneStorageError(Exception):
    """Base exception for zone storage operations."""


class ZoneDuplicateError(ZoneStorageError):
    """Raised when a unique zone field already exists."""


def get_zone_by_id(
    db: Session,
    zone_id: int,
) -> Zone | None:
    return db.get(Zone, zone_id)


def get_zone_by_code(
    db: Session,
    zone_code: str,
) -> Zone | None:
    stmt = select(Zone).where(
        Zone.zone_code == zone_code
    )

    return db.execute(stmt).scalar_one_or_none()


def list_active_zones(
    db: Session,
) -> list[Zone]:
    stmt = (
        select(Zone)
        .where(Zone.is_active.is_(True))
        .order_by(Zone.id)
    )

    return list(
        db.execute(stmt).scalars().all()
    )


def create_zone(
    db: Session,
    *,
    zone_code: str,
    zone_name: str,
    is_active: bool = True,
) -> Zone:
    zone = Zone(
        zone_code=zone_code,
        zone_name=zone_name,
        is_active=is_active,
    )

    try:
        db.add(zone)
        db.commit()
        db.refresh(zone)

    except IntegrityError as exc:
        db.rollback()

        raise ZoneDuplicateError(
            "Zone code or zone name already exists."
        ) from exc

    return zone


def update_zone(
    db: Session,
    zone_id: int,
    *,
    zone_code: str | None = None,
    zone_name: str | None = None,
    is_active: bool | None = None,
) -> Zone | None:
    zone = db.get(Zone, zone_id)

    if zone is None:
        return None

    if zone_code is not None:
        zone.zone_code = zone_code

    if zone_name is not None:
        zone.zone_name = zone_name

    if is_active is not None:
        zone.is_active = is_active

    try:
        db.commit()
        db.refresh(zone)

    except IntegrityError as exc:
        db.rollback()

        raise ZoneDuplicateError(
            "Zone code or zone name already exists."
        ) from exc

    return zone