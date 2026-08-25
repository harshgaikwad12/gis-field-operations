from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.authorization import get_current_officer_scope
from app.core.rbac import Role
from app.db.session import get_db
from app.models.zone import Zone
from app.services.area_storage import list_active_areas
from app.services.field_area_storage import list_active_field_areas
from app.services.master_meter_storage import list_master_meters_for_scope
from app.services.officer_storage import list_active_officers

router = APIRouter(
    prefix="/admin",
    tags=["admin"],
)


class DashboardZoneResponse(BaseModel):
    id: int
    code: str
    name: str


class DashboardSummaryResponse(BaseModel):
    areas: int
    field_areas: int
    officers: int
    master_meters: int
    pending_consumers: int


class ZonalAdminDashboardResponse(BaseModel):
    zone: DashboardZoneResponse
    summary: DashboardSummaryResponse


@router.get(
    "/dashboard",
    response_model=ZonalAdminDashboardResponse,
)
def get_zonal_admin_dashboard(
    db: Session = Depends(get_db),
    scope=Depends(get_current_officer_scope),
):
    if scope.role != Role.ADMIN:
        raise HTTPException(
            status_code=403,
            detail="Zonal Admin access required.",
        )

    zone = db.get(Zone, scope.zone_id)

    if zone is None or not zone.is_active:
        raise HTTPException(
            status_code=404,
            detail="Assigned zone not found or inactive.",
        )

    areas = list_active_areas(
        db,
        zone_id=scope.zone_id,
    )

    field_areas = [
        field_area
        for area in areas
        for field_area in list_active_field_areas(
            db,
            area_id=area.id,
        )
    ]

    officers = list_active_officers(
        db,
        zone_id=scope.zone_id,
    )

    master_meters = list_master_meters_for_scope(
        db,
        scope,
    )

    return ZonalAdminDashboardResponse(
        zone=DashboardZoneResponse(
            id=zone.id,
            code=zone.zone_code,
            name=zone.zone_name,
        ),
        summary=DashboardSummaryResponse(
            areas=len(areas),
            field_areas=len(field_areas),
            officers=len(officers),
            master_meters=len(master_meters),
            pending_consumers=0,
        ),
    )
