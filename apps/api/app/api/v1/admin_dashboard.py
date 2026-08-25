from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.authorization import get_current_officer
from app.core.scope import get_officer_scope
from app.db.session import get_db
from app.models.area import Area
from app.models.field_area import FieldArea
from app.models.master_meter import MasterMeter
from app.models.pending_consumer import PendingConsumer
from app.models.zone import Zone
from app.models.officer import Officer


router = APIRouter(
    prefix="/admin/dashboard",
    tags=["admin-dashboard"],
)


@router.get("")
def get_admin_dashboard(
    db: Session = Depends(get_db),
    officer: Officer = Depends(get_current_officer),
):
    if officer.role != "ADMIN":
        raise HTTPException(
            status_code=403,
            detail="ADMIN role required.",
        )

    scope = get_officer_scope(officer)

    zone = db.get(Zone, scope.zone_id) if scope.zone_id is not None else None

    if zone is None:
        zone = db.query(Zone).filter(Zone.is_active.is_(True)).first()

    if zone is None:
        raise HTTPException(
            status_code=404,
            detail="Assigned zone not found.",
        )

    target_zone_id = zone.id

    areas = (
        db.query(Area)
        .filter(
            Area.zone_id == target_zone_id,
            Area.is_active.is_(True),
        )
        .all()
    )

    field_areas = (
        db.query(FieldArea)
        .join(
            Area,
            FieldArea.area_id == Area.id,
        )
        .filter(
            Area.zone_id == target_zone_id,
            FieldArea.is_active.is_(True),
        )
        .all()
    )

    master_meters = (
        db.query(MasterMeter)
        .filter(
            MasterMeter.zone_id == target_zone_id,
        )
        .all()
    )

    pending_consumers = (
        db.query(PendingConsumer)
        .all()
    )

    area_rows = []

    for area in areas:
        area_field_areas = [
            field_area
            for field_area in field_areas
            if field_area.area_id == area.id
        ]

        area_master_meters = [
            meter
            for meter in master_meters
            if meter.area_id == area.id
        ]

        area_rows.append(
            {
                "id": area.id,
                "area_id": area.id,
                "code": area.area_code,
                "area_code": area.area_code,
                "name": area.area_name,
                "area_name": area.area_name,
                "field_areas": len(area_field_areas),
                "field_area_count": len(area_field_areas),
                "master_meters": len(area_master_meters),
                "master_meter_count": len(area_master_meters),
                "consumers": 0,
                "consumer_count": 0,
            }
        )

    meter_rows = db.execute(
        select(
            MasterMeter.id,
            MasterMeter.meter_id,
            MasterMeter.customer_name,
            Area.area_name,
            func.ST_Y(MasterMeter.location).label("latitude"),
            func.ST_X(MasterMeter.location).label("longitude"),
        )
        .outerjoin(Area, MasterMeter.area_id == Area.id)
        .where(MasterMeter.zone_id == target_zone_id)
    ).all()

    meter_list = [
        {
            "id": r.id,
            "meter_id": r.meter_id,
            "consumer_name": r.customer_name,
            "address": None,
            "latitude": r.latitude,
            "longitude": r.longitude,
            "zone_name": zone.zone_name,
            "area_name": r.area_name,
        }
        for r in meter_rows
    ]

    return {
        "zone": {
            "id": zone.id,
            "code": zone.zone_code,
            "zone_code": zone.zone_code,
            "name": zone.zone_name,
            "zone_name": zone.zone_name,
        },
        "summary": {
            "areas": len(areas),
            "area_count": len(areas),
            "field_areas": len(field_areas),
            "field_area_count": len(field_areas),
            "master_meters": len(master_meters),
            "master_meter_count": len(master_meters),
            "pending_consumers": len(pending_consumers),
            "pending_consumer_count": len(pending_consumers),
        },
        "areas": area_rows,
        "meters": meter_list,
    }