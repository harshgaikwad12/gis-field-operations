from datetime import datetime, timezone

from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.password import (
    hash_password,
    verify_password,
)
from app.models.officer import Officer
from app.models.zone import Zone


class OfficerStorageError(Exception):
    """Base exception for officer storage operations."""


class OfficerDuplicateError(OfficerStorageError):
    """Raised when a unique officer field already exists."""


def get_officer_by_id(
    db: Session,
    officer_id: int,
) -> Officer | None:
    return db.get(Officer, officer_id)


def get_officer_by_code(
    db: Session,
    officer_code: str,
) -> Officer | None:
    cleaned = officer_code.strip()
    stmt = select(Officer).where(
        func.lower(Officer.officer_code) == cleaned.lower()
    )

    return db.execute(stmt).scalar_one_or_none()


def get_officer_by_email(
    db: Session,
    email: str,
) -> Officer | None:
    cleaned = email.strip()
    stmt = select(Officer).where(
        func.lower(Officer.email) == cleaned.lower()
    )

    return db.execute(stmt).scalar_one_or_none()


def get_officer_by_phone(
    db: Session,
    phone: str,
) -> Officer | None:
    cleaned = phone.strip()
    stmt = select(Officer).where(
        Officer.phone == cleaned
    )

    return db.execute(stmt).scalar_one_or_none()


def create_officer(
    db: Session,
    *,
    officer_code: str,
    officer_name: str,
    email: str,
    phone: str,
    password: str,
    role: str,
    is_active: bool = True,
    zone_id: int | None = None,
    area_id: int | None = None,
    field_area_id: int | None = None,
) -> Officer:
    if get_officer_by_code(db, officer_code):
        raise OfficerDuplicateError("Officer code already exists.")

    if get_officer_by_email(db, email):
        raise OfficerDuplicateError("Email address already exists.")

    if get_officer_by_phone(db, phone):
        raise OfficerDuplicateError("Phone number already exists.")

    if zone_id is not None:
        zone = db.get(Zone, zone_id)
        if zone is None or not zone.is_active:
            raise ValueError("Specified zone does not exist or is inactive.")

    officer = Officer(
        officer_code=officer_code,
        officer_name=officer_name,
        email=email,
        phone=phone,
        password_hash=hash_password(password),
        role=role,
        is_active=is_active,
        zone_id=zone_id,
        area_id=area_id,
        field_area_id=field_area_id,
    )

    try:
        db.add(officer)
        db.commit()
        db.refresh(officer)

    except IntegrityError as exc:
        db.rollback()

        raise OfficerDuplicateError(
            "Officer code, email, or phone already exists."
        ) from exc

    return officer


def authenticate_officer(
    db: Session,
    *,
    email: str,
    password: str,
) -> Officer | None:
    identifier = email.strip()
    if not identifier:
        return None

    stmt = select(Officer).where(
        or_(
            func.lower(Officer.email) == identifier.lower(),
            func.lower(Officer.officer_code) == identifier.lower(),
            Officer.phone == identifier,
        )
    )

    officer = db.execute(stmt).scalars().first()

    if officer is None:
        return None

    if not officer.is_active:
        return None

    if not verify_password(
        password,
        officer.password_hash,
    ):
        return None

    return officer


def update_officer(
    db: Session,
    officer_id: int,
    *,
    officer_code: str | None = None,
    officer_name: str | None = None,
    email: str | None = None,
    phone: str | None = None,
    password: str | None = None,
    role: str | None = None,
    is_active: bool | None = None,
    zone_id: int | None = None,
    area_id: int | None = None,
    field_area_id: int | None = None,
) -> Officer | None:
    officer = db.get(
        Officer,
        officer_id,
    )

    if officer is None:
        return None

    if officer_code is not None:
        officer.officer_code = officer_code

    if officer_name is not None:
        officer.officer_name = officer_name

    if email is not None:
        officer.email = email

    if phone is not None:
        officer.phone = phone

    if password is not None:
        officer.password_hash = hash_password(
            password
        )

    if role is not None:
        officer.role = role

    if is_active is not None:
        officer.is_active = is_active

    if zone_id is not None:
        officer.zone_id = zone_id

    if area_id is not None:
        officer.area_id = area_id

    if field_area_id is not None:
        officer.field_area_id = field_area_id

    officer.updated_at = datetime.now(
        timezone.utc
    )

    try:
        db.commit()
        db.refresh(officer)

    except IntegrityError as exc:
        db.rollback()

        raise OfficerDuplicateError(
            "Officer code, email, or phone already exists."
        ) from exc

    return officer


def list_active_officers(
    db: Session,
) -> list[Officer]:
    stmt = (
        select(Officer)
        .where(Officer.is_active.is_(True))
        .order_by(Officer.id)
    )

    return list(
        db.execute(stmt).scalars().all()
    )