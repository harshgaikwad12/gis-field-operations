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
    prefix="/super-admin",
    tags=["Super Admin"],
)


class ZonalAdminInfo(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    officer_code: str
    officer_name: str
    email: str
    phone: str
    is_active: bool = True


class UpdateAdminStatusRequest(BaseModel):
    status: str  # "ACTIVE", "INACTIVE", "DELETED"


class SuperAdminMeterItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    meter_id: str
    consumer_name: str | None = None
    address: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    zone_name: str | None = None


class SuperAdminZoneDetail(BaseModel):
    id: int
    zone_code: str
    zone_name: str
    is_active: bool
    zonal_admin: ZonalAdminInfo | None = None
    area_count: int
    field_area_count: int
    master_meter_count: int
    consumer_count: int


class SuperAdminSummary(BaseModel):
    total_zones: int
    total_zonal_admins: int
    total_areas: int
    total_field_areas: int
    total_master_meters: int
    total_pending_consumers: int


class SuperAdminDashboardResponse(BaseModel):
    state_name: str = "Maharashtra"
    summary: SuperAdminSummary
    zones: list[SuperAdminZoneDetail]
    meters: list[SuperAdminMeterItem] = []


@router.get(
    "/dashboard",
    response_model=SuperAdminDashboardResponse,
)
def get_super_admin_dashboard(
    db: Session = Depends(get_db),
    current_officer: Officer = Depends(get_current_officer),
):
    if current_officer.role != "SUPER_ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="SUPER_ADMIN role required.",
        )

    # 1. Fetch State-wide Summary
    all_zones = db.scalars(
        select(Zone).where(Zone.is_active.is_(True)).order_by(Zone.id)
    ).all()

    total_zonal_admins = db.scalar(
        select(func.count(Officer.id)).where(
            Officer.role == "ADMIN",
            Officer.is_active.is_(True),
        )
    ) or 0

    total_areas = db.scalar(
        select(func.count(Area.id)).where(Area.is_active.is_(True))
    ) or 0

    total_field_areas = db.scalar(
        select(func.count(FieldArea.id)).where(FieldArea.is_active.is_(True))
    ) or 0

    total_master_meters = db.scalar(
        select(func.count(MasterMeter.id))
    ) or 0

    total_pending_consumers = db.scalar(
        select(func.count(PendingConsumer.id))
    ) or 0

    # 2. Fetch Zonal Admins map (zone_id -> Officer)
    zonal_admins = db.scalars(
        select(Officer).where(
            Officer.role == "ADMIN",
            Officer.zone_id.isnot(None),
        )
    ).all()

    admin_by_zone_id: dict[int, Officer] = {
        admin.zone_id: admin for admin in zonal_admins if admin.zone_id is not None
    }

    # 3. Build Zone Details
    zone_details: list[SuperAdminZoneDetail] = []

    for zone in all_zones:
        area_count = db.scalar(
            select(func.count(Area.id)).where(
                Area.zone_id == zone.id,
                Area.is_active.is_(True),
            )
        ) or 0

        field_area_count = db.scalar(
            select(func.count(FieldArea.id)).join(
                Area, FieldArea.area_id == Area.id
            ).where(
                Area.zone_id == zone.id,
                FieldArea.is_active.is_(True),
            )
        ) or 0

        master_meter_count = db.scalar(
            select(func.count(MasterMeter.id)).where(
                MasterMeter.zone_id == zone.id
            )
        ) or 0

        assigned_admin = admin_by_zone_id.get(zone.id)
        admin_info = (
            ZonalAdminInfo.model_validate(assigned_admin)
            if assigned_admin
            else None
        )

        zone_details.append(
            SuperAdminZoneDetail(
                id=zone.id,
                zone_code=zone.zone_code,
                zone_name=zone.zone_name,
                is_active=zone.is_active,
                zonal_admin=admin_info,
                area_count=area_count,
                field_area_count=field_area_count,
                master_meter_count=master_meter_count,
                consumer_count=0,
            )
        )

    # 4. Fetch Master Meters for State Map
    meter_rows = db.execute(
        select(
            MasterMeter.id,
            MasterMeter.meter_id,
            MasterMeter.customer_name,
            MasterMeter.zone_id,
            func.ST_Y(MasterMeter.location).label("latitude"),
            func.ST_X(MasterMeter.location).label("longitude"),
        ).order_by(MasterMeter.id)
    ).all()
    zone_dict = {z.id: z.zone_name for z in all_zones}

    meter_items = [
        SuperAdminMeterItem(
            id=r.id,
            meter_id=r.meter_id,
            consumer_name=r.customer_name,
            address=None,
            latitude=r.latitude,
            longitude=r.longitude,
            zone_name=zone_dict.get(r.zone_id) if r.zone_id else None,
        )
        for r in meter_rows
    ]

    return SuperAdminDashboardResponse(
        state_name="Maharashtra",
        summary=SuperAdminSummary(
            total_zones=len(all_zones),
            total_zonal_admins=total_zonal_admins,
            total_areas=total_areas,
            total_field_areas=total_field_areas,
            total_master_meters=total_master_meters,
            total_pending_consumers=total_pending_consumers,
        ),
        zones=zone_details,
        meters=meter_items,
    )


@router.patch("/officers/{officer_id}/status")
def update_zonal_admin_status(
    officer_id: int,
    payload: UpdateAdminStatusRequest,
    db: Session = Depends(get_db),
    current_officer: Officer = Depends(get_current_officer),
):
    if current_officer.role != "SUPER_ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="SUPER_ADMIN role required.",
        )
    officer = db.get(Officer, officer_id)
    if not officer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Officer not found.",
        )

    status_upper = payload.status.strip().upper()
    if status_upper in ("ACTIVE", "ACTIVATE"):
        officer.is_active = True
    elif status_upper in ("INACTIVE", "UNACTIVE", "DEACTIVATE"):
        officer.is_active = False
    elif status_upper in ("DELETED", "DELETE", "UNASSIGN"):
        officer.is_active = False
        officer.zone_id = None
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid status. Allowed values: ACTIVE, INACTIVE, DELETED.",
        )

    db.commit()
    db.refresh(officer)
    return {
        "status": "success",
        "officer_id": officer.id,
        "is_active": officer.is_active,
        "zone_id": officer.zone_id,
    }


@router.patch("/zones/{zone_id}/status")
def update_zone_status(
    zone_id: int,
    payload: UpdateAdminStatusRequest,
    db: Session = Depends(get_db),
    current_officer: Officer = Depends(get_current_officer),
):
    if current_officer.role != "SUPER_ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="SUPER_ADMIN role required.",
        )
    zone = db.get(Zone, zone_id)
    if not zone:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Zone not found.",
        )

    status_upper = payload.status.strip().upper()
    if status_upper in ("ACTIVE", "ACTIVATE"):
        zone.is_active = True
    elif status_upper in ("INACTIVE", "UNACTIVE", "DEACTIVATE", "DELETED"):
        zone.is_active = False
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid status. Allowed values: ACTIVE, INACTIVE, DELETED.",
        )

    db.commit()
    db.refresh(zone)
    return {
        "status": "success",
        "zone_id": zone.id,
        "is_active": zone.is_active,
    }
