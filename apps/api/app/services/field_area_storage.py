from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.field_area import FieldArea


class FieldAreaStorageError(Exception):
    """Base exception for field area storage operations."""


class FieldAreaDuplicateError(FieldAreaStorageError):
    """Raised when a unique field area field already exists."""


def get_field_area_by_id(
    db: Session,
    field_area_id: int,
) -> FieldArea | None:
    return db.get(FieldArea, field_area_id)


def get_field_area_by_code(
    db: Session,
    field_area_code: str,
) -> FieldArea | None:
    stmt = select(FieldArea).where(
        FieldArea.field_area_code == field_area_code
    )

    return db.execute(stmt).scalar_one_or_none()


def list_active_field_areas(
    db: Session,
    area_id: int | None = None,
) -> list[FieldArea]:
    stmt = select(FieldArea).where(
        FieldArea.is_active.is_(True)
    )

    if area_id is not None:
        stmt = stmt.where(
            FieldArea.area_id == area_id
        )

    stmt = stmt.order_by(FieldArea.id)

    return list(
        db.execute(stmt).scalars().all()
    )


def create_field_area(
    db: Session,
    *,
    field_area_code: str,
    field_area_name: str,
    area_id: int,
    is_active: bool = True,
) -> FieldArea:
    field_area = FieldArea(
        field_area_code=field_area_code,
        field_area_name=field_area_name,
        area_id=area_id,
        is_active=is_active,
    )

    try:
        db.add(field_area)
        db.commit()
        db.refresh(field_area)

    except IntegrityError as exc:
        db.rollback()

        raise FieldAreaDuplicateError(
            "Field area code already exists or the specified area is invalid."
        ) from exc

    return field_area


def update_field_area(
    db: Session,
    field_area_id: int,
    *,
    field_area_code: str | None = None,
    field_area_name: str | None = None,
    area_id: int | None = None,
    is_active: bool | None = None,
) -> FieldArea | None:
    field_area = db.get(
        FieldArea,
        field_area_id,
    )

    if field_area is None:
        return None

    if field_area_code is not None:
        field_area.field_area_code = field_area_code

    if field_area_name is not None:
        field_area.field_area_name = field_area_name

    if area_id is not None:
        field_area.area_id = area_id

    if is_active is not None:
        field_area.is_active = is_active

    try:
        db.commit()
        db.refresh(field_area)

    except IntegrityError as exc:
        db.rollback()

        raise FieldAreaDuplicateError(
            "Field area code already exists or the specified area is invalid."
        ) from exc

    return field_area