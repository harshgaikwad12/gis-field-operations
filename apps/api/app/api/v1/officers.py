from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
)
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from app.core.authorization import require_permission
from app.core.rbac import Permission
from app.db.session import get_db
from app.models.officer import Officer
from app.services.officer_storage import (
    OfficerDuplicateError,
    create_officer,
    get_officer_by_id,
    list_active_officers,
    update_officer,
)


router = APIRouter(
    prefix="/officers",
    tags=["Officers"],
)


# ============================================================
# REQUEST / RESPONSE SCHEMAS
# ============================================================


class OfficerCreate(BaseModel):
    officer_code: str
    officer_name: str
    email: str
    phone: str
    password: str
    role: str
    is_active: bool = True


class ZonalAdminCreate(BaseModel):
    officer_code: str
    officer_name: str
    email: str
    phone: str
    password: str
    zone_id: int
    is_active: bool = True


class AreaAdminCreate(BaseModel):
    officer_code: str
    officer_name: str
    email: str
    phone: str
    password: str
    area_id: int
    is_active: bool = True


class FieldOfficerCreate(BaseModel):
    officer_code: str
    officer_name: str
    email: str
    phone: str
    password: str
    field_area_id: int
    is_active: bool = True


class OfficerUpdate(BaseModel):
    officer_code: str | None = None
    officer_name: str | None = None
    email: str | None = None
    phone: str | None = None
    password: str | None = None
    role: str | None = None
    is_active: bool | None = None


class OfficerResponse(BaseModel):
    model_config = ConfigDict(
        from_attributes=True
    )

    id: int
    officer_code: str
    officer_name: str
    email: str
    phone: str
    role: str
    is_active: bool


# ============================================================
# RESPONSE CONVERSION
# ============================================================


def officer_to_response(
    officer: Officer,
) -> OfficerResponse:
    return OfficerResponse.model_validate(
        officer
    )


# ============================================================
# CREATE OFFICER
# ============================================================


@router.post(
    "",
    response_model=OfficerResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_officer_api(
    payload: OfficerCreate,
    db: Session = Depends(get_db),
    current_officer: Officer = Depends(
        require_permission(
            Permission.MANAGE_OFFICERS
        )
    ),
):
    try:
        officer = create_officer(
            db,
            officer_code=payload.officer_code,
            officer_name=payload.officer_name,
            email=payload.email,
            phone=payload.phone,
            password=payload.password,
            role=payload.role,
            is_active=payload.is_active,
        )

    except OfficerDuplicateError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc

    return officer_to_response(
        officer
    )


# ============================================================
# CREATE ZONAL ADMIN
# ============================================================


@router.post(
    "/zonal-admin",
    response_model=OfficerResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_zonal_admin_api(
    payload: ZonalAdminCreate,
    db: Session = Depends(get_db),
    current_officer: Officer = Depends(
        require_permission(
            Permission.MANAGE_OFFICERS
        )
    ),
):
    if current_officer.role != "SUPER_ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Super Administrator can create Zonal Administrators.",
        )

    try:
        officer = create_officer(
            db,
            officer_code=payload.officer_code,
            officer_name=payload.officer_name,
            email=payload.email,
            phone=payload.phone,
            password=payload.password,
            role="ADMIN",
            is_active=payload.is_active,
            zone_id=payload.zone_id,
        )

    except OfficerDuplicateError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    return officer_to_response(
        officer
    )


# ============================================================
# CREATE AREA ADMIN
# ============================================================


@router.post(
    "/area-admin",
    response_model=OfficerResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_area_admin_api(
    payload: AreaAdminCreate,
    db: Session = Depends(get_db),
    current_officer: Officer = Depends(
        require_permission(
            Permission.MANAGE_OFFICERS
        )
    ),
):
    from app.models.area import Area

    area = db.get(Area, payload.area_id)
    if area is None or not area.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Specified area does not exist or is inactive.",
        )

    if current_officer.role == "ADMIN":
        if current_officer.zone_id != area.zone_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only assign area admins to areas within your own zone.",
            )
    elif current_officer.role != "SUPER_ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission denied to create Area Administrator.",
        )

    try:
        officer = create_officer(
            db,
            officer_code=payload.officer_code,
            officer_name=payload.officer_name,
            email=payload.email,
            phone=payload.phone,
            password=payload.password,
            role="AREA_ADMIN",
            is_active=payload.is_active,
            zone_id=area.zone_id,
            area_id=area.id,
        )

    except OfficerDuplicateError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    return officer_to_response(officer)



# ============================================================
# CREATE FIELD OFFICER
# ============================================================


@router.post(
    "/field-officer",
    response_model=OfficerResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_field_officer_api(
    payload: FieldOfficerCreate,
    db: Session = Depends(get_db),
    current_officer: Officer = Depends(
        require_permission(
            Permission.MANAGE_OFFICERS
        )
    ),
):
    from app.models.field_area import FieldArea

    field_area = db.get(FieldArea, payload.field_area_id)
    if field_area is None or not field_area.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Field area not found or is inactive.",
        )

    if current_officer.role == "AREA_ADMIN":
        if field_area.area_id != current_officer.area_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only assign field officers to field areas within your own Area.",
            )
        zone_id = current_officer.zone_id
        area_id = current_officer.area_id
    else:
        from app.models.area import Area
        area = db.get(Area, field_area.area_id)
        zone_id = area.zone_id if area else None
        area_id = field_area.area_id

    try:
        officer = create_officer(
            db,
            officer_code=payload.officer_code,
            officer_name=payload.officer_name,
            email=payload.email,
            phone=payload.phone,
            password=payload.password,
            role="FIELD_OFFICER",
            is_active=payload.is_active,
            zone_id=zone_id,
            area_id=area_id,
            field_area_id=payload.field_area_id,
        )

    except OfficerDuplicateError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    return officer_to_response(officer)


# ============================================================
# LIST ACTIVE OFFICERS
# ============================================================


@router.get(
    "",
    response_model=list[OfficerResponse],
)
def list_officers_api(
    db: Session = Depends(get_db),
    current_officer: Officer = Depends(
        require_permission(
            Permission.MANAGE_OFFICERS
        )
    ),
):
    officers = list_active_officers(
        db
    )

    return [
        officer_to_response(officer)
        for officer in officers
    ]


# ============================================================
# GET OFFICER
# ============================================================


@router.get(
    "/{officer_id}",
    response_model=OfficerResponse,
)
def get_officer_api(
    officer_id: int,
    db: Session = Depends(get_db),
    current_officer: Officer = Depends(
        require_permission(
            Permission.MANAGE_OFFICERS
        )
    ),
):
    officer = get_officer_by_id(
        db,
        officer_id,
    )

    if officer is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Officer not found.",
        )

    return officer_to_response(
        officer
    )


# ============================================================
# UPDATE OFFICER
# ============================================================


@router.patch(
    "/{officer_id}",
    response_model=OfficerResponse,
)
def update_officer_api(
    officer_id: int,
    payload: OfficerUpdate,
    db: Session = Depends(get_db),
    current_officer: Officer = Depends(
        require_permission(
            Permission.MANAGE_OFFICERS
        )
    ),
):
    try:
        officer = update_officer(
            db,
            officer_id,
            officer_code=payload.officer_code,
            officer_name=payload.officer_name,
            email=payload.email,
            phone=payload.phone,
            password=payload.password,
            role=payload.role,
            is_active=payload.is_active,
        )

    except OfficerDuplicateError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc

    if officer is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Officer not found.",
        )

    return officer_to_response(
        officer
    )