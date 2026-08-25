from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.authorization import get_current_officer
from app.db.session import get_db
from app.models.area import Area
from app.models.field_area import FieldArea
from app.models.master_meter import MasterMeter
from app.models.officer import Officer
from app.models.pending_consumer import PendingConsumer
from app.models.zone import Zone

router = APIRouter(
    prefix="/area-admin",
    tags=["Area Admin"],
)


class FieldOfficerInfo(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    officer_code: str
    officer_name: str
    email: str
    phone: str


class AreaAdminFieldAreaDetail(BaseModel):
    id: int
    field_area_code: str
    field_area_name: str
    is_active: bool
    assigned_officer: FieldOfficerInfo | None = None
    master_meter_count: int


class AreaAdminSummary(BaseModel):
    field_areas: int
    field_officers: int
    master_meters: int
    pending_consumers: int


class AreaAdminMeterItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    meter_id: str
    consumer_name: str | None = None
    address: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    field_area_name: str | None = None


class AreaAdminDashboardResponse(BaseModel):
    zone_id: int
    zone_code: str
    zone_name: str
    area_id: int
    area_code: str
    area_name: str
    summary: AreaAdminSummary
    field_areas: list[AreaAdminFieldAreaDetail]
    meters: list[AreaAdminMeterItem] = []


@router.get(
    "/dashboard",
    response_model=AreaAdminDashboardResponse,
)
def get_area_admin_dashboard(
    db: Session = Depends(get_db),
    current_officer: Officer = Depends(get_current_officer),
):
    if current_officer.role != "AREA_ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="AREA_ADMIN role required.",
        )

    if current_officer.area_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Officer is not assigned to an Area.",
        )

    # 1. Fetch Area and Zone information
    area = db.get(Area, current_officer.area_id)
    if not area or not area.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assigned Area not found or is inactive.",
        )

    zone = db.get(Zone, current_officer.zone_id)
    if not zone or not zone.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assigned Zone not found or is inactive.",
        )

    # 2. Fetch Stats & Totals for the Area
    all_field_areas = db.scalars(
        select(FieldArea)
        .where(
            FieldArea.area_id == current_officer.area_id,
        )
        .order_by(FieldArea.id)
    ).all()

    field_officers_count = db.scalar(
        select(func.count(Officer.id)).where(
            Officer.role == "FIELD_OFFICER",
            Officer.area_id == current_officer.area_id,
            Officer.is_active.is_(True),
        )
    ) or 0

    master_meters_count = db.scalar(
        select(func.count(MasterMeter.id)).where(
            MasterMeter.area_id == current_officer.area_id
        )
    ) or 0

    pending_consumers_count = db.scalar(
        select(func.count(PendingConsumer.id))
        .join(MasterMeter, PendingConsumer.meter_id == MasterMeter.meter_id)
        .where(MasterMeter.area_id == current_officer.area_id)
    ) or 0

    # 3. Fetch Field Officers in this Area to map to Field Areas
    field_officers = db.scalars(
        select(Officer).where(
            Officer.role == "FIELD_OFFICER",
            Officer.area_id == current_officer.area_id,
            Officer.is_active.is_(True),
            Officer.field_area_id.isnot(None),
        )
    ).all()

    officer_by_field_area_id: dict[int, Officer] = {
        off.field_area_id: off
        for off in field_officers
        if off.field_area_id is not None
    }

    # 4. Compile Field Area Details
    field_area_details: list[AreaAdminFieldAreaDetail] = []
    for fa in all_field_areas:
        meters_count = db.scalar(
            select(func.count(MasterMeter.id)).where(
                MasterMeter.field_area_id == fa.id
            )
        ) or 0

        assigned_off = officer_by_field_area_id.get(fa.id)
        officer_info = (
            FieldOfficerInfo.model_validate(assigned_off)
            if assigned_off
            else None
        )

        field_area_details.append(
            AreaAdminFieldAreaDetail(
                id=fa.id,
                field_area_code=fa.field_area_code,
                field_area_name=fa.field_area_name,
                is_active=fa.is_active,
                assigned_officer=officer_info,
                master_meter_count=meters_count,
            )
        )

    # 5. Fetch Area Master Meters for Map
    meter_rows = db.execute(
        select(
            MasterMeter.id,
            MasterMeter.meter_id,
            MasterMeter.customer_name,
            MasterMeter.field_area_id,
            func.ST_Y(MasterMeter.location).label("latitude"),
            func.ST_X(MasterMeter.location).label("longitude"),
        )
        .where(MasterMeter.area_id == current_officer.area_id)
        .order_by(MasterMeter.id)
    ).all()
    fa_dict = {fa.id: fa.field_area_name for fa in all_field_areas}

    meter_items = [
        AreaAdminMeterItem(
            id=r.id,
            meter_id=r.meter_id,
            consumer_name=r.customer_name,
            address=None,
            latitude=r.latitude,
            longitude=r.longitude,
            field_area_name=fa_dict.get(r.field_area_id) if r.field_area_id else None,
        )
        for r in meter_rows
    ]

    return AreaAdminDashboardResponse(
        zone_id=zone.id,
        zone_code=zone.zone_code,
        zone_name=zone.zone_name,
        area_id=area.id,
        area_code=area.area_code,
        area_name=area.area_name,
        summary=AreaAdminSummary(
            field_areas=len(all_field_areas),
            field_officers=field_officers_count,
            master_meters=master_meters_count,
            pending_consumers=pending_consumers_count,
        ),
        field_areas=field_area_details,
        meters=meter_items,
    )


class AreaAdminFieldAreaResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    field_area_code: str
    field_area_name: str
    area_id: int
    is_active: bool


@router.get(
    "/field-areas",
    response_model=list[AreaAdminFieldAreaResponse],
)
def get_area_admin_field_areas(
    db: Session = Depends(get_db),
    current_officer: Officer = Depends(get_current_officer),
):
    if current_officer.role != "AREA_ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="AREA_ADMIN role required.",
        )

    if current_officer.area_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Officer is not assigned to an Area.",
        )

    field_areas = db.scalars(
        select(FieldArea)
        .where(
            FieldArea.area_id == current_officer.area_id,
            FieldArea.is_active.is_(True),
        )
        .order_by(FieldArea.id)
    ).all()

    return field_areas


class UpdateStatusRequest(BaseModel):
    status: str


@router.patch("/field-areas/{field_area_id}/status")
def update_field_area_status(
    field_area_id: int,
    payload: UpdateStatusRequest,
    db: Session = Depends(get_db),
    current_officer: Officer = Depends(get_current_officer),
):
    if current_officer.role != "AREA_ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="AREA_ADMIN role required.",
        )
    fa = db.get(FieldArea, field_area_id)
    if not fa or fa.area_id != current_officer.area_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Field Area not found in your area scope.",
        )

    status_upper = payload.status.strip().upper()
    if status_upper in ("ACTIVE", "ACTIVATE"):
        fa.is_active = True
    elif status_upper in ("INACTIVE", "UNACTIVE", "DEACTIVATE", "DELETED"):
        fa.is_active = False
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid status. Allowed values: ACTIVE, INACTIVE, DELETED.",
        )

    db.commit()
    db.refresh(fa)
    return {
        "status": "success",
        "field_area_id": fa.id,
        "is_active": fa.is_active,
    }


@router.patch("/officers/{officer_id}/status")
def update_field_officer_status(
    officer_id: int,
    payload: UpdateStatusRequest,
    db: Session = Depends(get_db),
    current_officer: Officer = Depends(get_current_officer),
):
    if current_officer.role != "AREA_ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="AREA_ADMIN role required.",
        )
    off = db.get(Officer, officer_id)
    if not off or off.area_id != current_officer.area_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Officer not found in your area scope.",
        )

    status_upper = payload.status.strip().upper()
    if status_upper in ("ACTIVE", "ACTIVATE"):
        off.is_active = True
    elif status_upper in ("INACTIVE", "UNACTIVE", "DEACTIVATE"):
        off.is_active = False
    elif status_upper in ("DELETED", "DELETE", "UNASSIGN"):
        off.is_active = False
        off.field_area_id = None
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid status. Allowed values: ACTIVE, INACTIVE, DELETED.",
        )

    db.commit()
    db.refresh(off)
    return {
        "status": "success",
        "officer_id": off.id,
        "is_active": off.is_active,
        "field_area_id": off.field_area_id,
    }

