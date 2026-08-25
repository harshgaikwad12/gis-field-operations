from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.area import Area


class AreaStorageError(Exception):
    """Base exception for area storage operations."""


class AreaDuplicateError(AreaStorageError):
    """Raised when a unique area field already exists."""


def get_area_by_id(
    db: Session,
    area_id: int,
) -> Area | None:
    return db.get(Area, area_id)


def get_area_by_code(
    db: Session,
    area_code: str,
) -> Area | None:
    stmt = select(Area).where(
        Area.area_code == area_code
    )

    return db.execute(stmt).scalar_one_or_none()


def list_active_areas(
    db: Session,
    zone_id: int | None = None,
) -> list[Area]:
    stmt = select(Area).where(
        Area.is_active.is_(True)
    )

    if zone_id is not None:
        stmt = stmt.where(
            Area.zone_id == zone_id
        )

    stmt = stmt.order_by(Area.id)

    return list(
        db.execute(stmt).scalars().all()
    )


def create_area(
    db: Session,
    *,
    area_code: str,
    area_name: str,
    zone_id: int,
    is_active: bool = True,
) -> Area:
    area = Area(
        area_code=area_code,
        area_name=area_name,
        zone_id=zone_id,
        is_active=is_active,
    )

    try:
        db.add(area)
        db.commit()
        db.refresh(area)

    except IntegrityError as exc:
        db.rollback()

        raise AreaDuplicateError(
            "Area code already exists or the specified zone is invalid."
        ) from exc

    return area


def update_area(
    db: Session,
    area_id: int,
    *,
    area_code: str | None = None,
    area_name: str | None = None,
    zone_id: int | None = None,
    is_active: bool | None = None,
) -> Area | None:
    area = db.get(Area, area_id)

    if area is None:
        return None

    if area_code is not None:
        area.area_code = area_code

    if area_name is not None:
        area.area_name = area_name

    if zone_id is not None:
        area.zone_id = zone_id

    if is_active is not None:
        area.is_active = is_active

    try:
        db.commit()
        db.refresh(area)

    except IntegrityError as exc:
        db.rollback()

        raise AreaDuplicateError(
            "Area code already exists or the specified zone is invalid."
        ) from exc

    return area