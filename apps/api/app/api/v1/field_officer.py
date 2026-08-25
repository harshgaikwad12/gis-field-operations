from datetime import datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.authorization import get_current_officer
from app.db.session import get_db
from app.models.area import Area
from app.models.field_area import FieldArea
from app.models.field_visit_log import FieldVisitLog
from app.models.master_meter import MasterMeter
from app.models.officer import Officer
from app.models.pending_consumer import PendingConsumer
from app.models.zone import Zone
from app.services.pending_consumer_import import (
    validate_pending_consumer_file,
)
from app.services.pending_consumer_storage import (
    store_pending_consumers,
)

router = APIRouter(
    prefix="/field-officer",
    tags=["Field Officer"],
)


class CreateVisitLogRequest(BaseModel):
    consumer_id: str
    meter_id: str
    status: str  # "PAYMENT_RECOVERED", "PAYMENT_NOT_RECOVERED", "CONSUMER_CONTACTED", "CONSUMER_UNAVAILABLE", "METER_PROBLEM_IDENTIFIED", "OTHER"
    amount_collected: float = 0.0
    notes: str | None = None
    latitude: float | None = None
    longitude: float | None = None


class VisitLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    consumer_id: str
    meter_id: str
    officer_id: int
    field_area_id: int
    status: str
    amount_collected: float
    notes: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    created_at: datetime


class StatusCount(BaseModel):
    status: str
    count: int


class FieldOfficerReportResponse(BaseModel):
    officer_name: str
    officer_code: str
    field_area_name: str
    total_assigned_consumers: int
    total_visited_consumers: int
    total_unvisited_consumers: int
    total_recovered_amount: float
    total_outstanding_amount: float
    recovery_rate_percentage: float
    status_breakdown: list[StatusCount]
    recent_visits: list[VisitLogResponse]


class FieldOfficerSummaryResponse(BaseModel):
    assigned_meters: int
    assigned_consumers: int
    pending_work: int


class FieldOfficerMeterResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    meter_id: str
    consumer_name: str | None = None
    address: str | None = None
    latitude: float | None = None
    longitude: float | None = None


class FieldOfficerConsumerResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    consumer_id: str
    consumer_name: str
    meter_id: str
    address: str | None = None
    pending_amount: float | None = None
    days_pending: int | None = None


class FieldOfficerDashboardResponse(BaseModel):
    officer_name: str
    officer_code: str
    role: str
    zone_id: int
    zone_code: str
    zone_name: str
    area_id: int
    area_code: str
    area_name: str
    field_area_id: int
    field_area_code: str
    field_area_name: str
    summary: FieldOfficerSummaryResponse
    meters: list[FieldOfficerMeterResponse]
    consumers: list[FieldOfficerConsumerResponse]


@router.get(
    "/dashboard",
    response_model=FieldOfficerDashboardResponse,
)
def get_field_officer_dashboard(
    db: Session = Depends(get_db),
    current_officer: Officer = Depends(get_current_officer),
):
    if current_officer.role not in ("FIELD_OFFICER", "SUPER_ADMIN"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="FIELD_OFFICER or SUPER_ADMIN role required.",
        )

    field_area_id = current_officer.field_area_id

    # If Super Admin doesn't have field_area_id, fallback to first active field area for previewing
    if field_area_id is None:
        if current_officer.role == "SUPER_ADMIN":
            first_fa = db.scalars(
                select(FieldArea).where(FieldArea.is_active.is_(True))
            ).first()
            if first_fa:
                field_area_id = first_fa.id

    if field_area_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Officer is not assigned to a Field Area Ward.",
        )

    # Fetch Field Area, Area, Zone
    field_area = db.get(FieldArea, field_area_id)
    if not field_area or not field_area.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assigned Field Area not found or is inactive.",
        )

    area = db.get(Area, field_area.area_id)
    if not area or not area.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assigned Area not found or is inactive.",
        )

    zone = db.get(Zone, area.zone_id)
    if not zone or not zone.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assigned Zone not found or is inactive.",
        )

    # Fetch Master Meters for this Field Area
    meter_rows = db.execute(
        select(
            MasterMeter.id,
            MasterMeter.meter_id,
            MasterMeter.customer_name,
            func.ST_Y(MasterMeter.location).label("latitude"),
            func.ST_X(MasterMeter.location).label("longitude"),
        )
        .where(MasterMeter.field_area_id == field_area.id)
        .order_by(MasterMeter.id)
    ).all()

    # Fetch Pending Consumers for Master Meters in this Field Area
    meter_ids = [m.meter_id for m in meter_rows if m.meter_id]
    pending_consumers = []
    if meter_ids:
        pending_consumers = db.scalars(
            select(PendingConsumer)
            .where(PendingConsumer.meter_id.in_(meter_ids))
            .order_by(PendingConsumer.id)
        ).all()

    meter_responses = [
        FieldOfficerMeterResponse(
            id=m.id,
            meter_id=m.meter_id,
            consumer_name=m.customer_name,
            address=None,
            latitude=m.latitude,
            longitude=m.longitude,
        )
        for m in meter_rows
    ]

    consumer_responses = [
        FieldOfficerConsumerResponse(
            id=c.id,
            consumer_id=c.consumer_id,
            consumer_name=c.consumer_name,
            meter_id=c.meter_id,
            address=getattr(c, "address", None),
            pending_amount=float(c.pending_amount) if c.pending_amount is not None else None,
            days_pending=c.days_pending,
        )
        for c in pending_consumers
    ]

    return FieldOfficerDashboardResponse(
        officer_name=current_officer.officer_name,
        officer_code=current_officer.officer_code,
        role=current_officer.role,
        zone_id=zone.id,
        zone_code=zone.zone_code,
        zone_name=zone.zone_name,
        area_id=area.id,
        area_code=area.area_code,
        area_name=area.area_name,
        field_area_id=field_area.id,
        field_area_code=field_area.field_area_code,
        field_area_name=field_area.field_area_name,
        summary=FieldOfficerSummaryResponse(
            assigned_meters=len(meter_responses),
            assigned_consumers=len(consumer_responses),
            pending_work=len(consumer_responses),
        ),
        meters=meter_responses,
        consumers=consumer_responses,
    )


@router.post("/upload-pending-consumers")
async def upload_field_officer_pending_consumers(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_officer: Officer = Depends(get_current_officer),
):
    if current_officer.role not in ("FIELD_OFFICER", "AREA_ADMIN", "ADMIN", "SUPER_ADMIN"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Authorized officer role required.",
        )

    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File is required.",
        )

    filename = file.filename.lower()
    if not filename.endswith((".csv", ".xlsx")):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only CSV and XLSX files are supported.",
        )

    content = await file.read()
    if not content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty.",
        )

    try:
        rows, errors = validate_pending_consumer_file(
            file.filename,
            content,
        )
    except UnicodeDecodeError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="CSV file must use UTF-8 encoding.",
        ) from exc
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    if errors:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "message": "File validation failed. No records were imported.",
                "errors": [
                    {
                        "row": error.row,
                        "field": error.field,
                        "message": error.message,
                    }
                    for error in errors
                ],
            },
        )

    try:
        result = store_pending_consumers(db, rows)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database import failed.",
        ) from exc

    return {
        "status": "imported",
        "filename": file.filename,
        "rows": len(rows),
        "inserted": result["inserted"],
        "updated": result["updated"],
        "message": "Pending consumer data imported successfully.",
    }


@router.post("/visits", response_model=VisitLogResponse)
def record_field_visit(
    payload: CreateVisitLogRequest,
    db: Session = Depends(get_db),
    current_officer: Officer = Depends(get_current_officer),
):
    if current_officer.role not in ("FIELD_OFFICER", "SUPER_ADMIN"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="FIELD_OFFICER or SUPER_ADMIN role required.",
        )

    field_area_id = current_officer.field_area_id
    if field_area_id is None and current_officer.role == "SUPER_ADMIN":
        first_fa = db.scalars(
            select(FieldArea).where(FieldArea.is_active.is_(True))
        ).first()
        if first_fa:
            field_area_id = first_fa.id

    if field_area_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Field Officer is not assigned to any field area.",
        )

    # Record the visit
    visit_log = FieldVisitLog(
        consumer_id=payload.consumer_id,
        meter_id=payload.meter_id,
        officer_id=current_officer.id,
        field_area_id=field_area_id,
        status=payload.status,
        amount_collected=Decimal(str(payload.amount_collected)),
        notes=payload.notes,
        latitude=payload.latitude,
        longitude=payload.longitude,
    )
    db.add(visit_log)

    # If payment recovered, update consumer pending amount
    if payload.status == "PAYMENT_RECOVERED" and payload.amount_collected > 0:
        consumer = db.scalars(
            select(PendingConsumer).where(
                PendingConsumer.consumer_id == payload.consumer_id
            )
        ).first()
        if consumer:
            new_amount = max(
                Decimal("0.00"),
                consumer.pending_amount - Decimal(str(payload.amount_collected)),
            )
            consumer.pending_amount = new_amount

    db.commit()
    db.refresh(visit_log)

    return VisitLogResponse(
        id=visit_log.id,
        consumer_id=visit_log.consumer_id,
        meter_id=visit_log.meter_id,
        officer_id=visit_log.officer_id,
        field_area_id=visit_log.field_area_id,
        status=visit_log.status,
        amount_collected=float(visit_log.amount_collected),
        notes=visit_log.notes,
        latitude=float(visit_log.latitude) if visit_log.latitude is not None else None,
        longitude=float(visit_log.longitude) if visit_log.longitude is not None else None,
        created_at=visit_log.created_at,
    )


@router.get("/visits", response_model=list[VisitLogResponse])
def get_field_officer_visits(
    db: Session = Depends(get_db),
    current_officer: Officer = Depends(get_current_officer),
):
    if current_officer.role not in ("FIELD_OFFICER", "SUPER_ADMIN"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="FIELD_OFFICER or SUPER_ADMIN role required.",
        )

    logs = db.scalars(
        select(FieldVisitLog)
        .where(FieldVisitLog.officer_id == current_officer.id)
        .order_by(FieldVisitLog.created_at.desc())
    ).all()

    return [
        VisitLogResponse(
            id=log.id,
            consumer_id=log.consumer_id,
            meter_id=log.meter_id,
            officer_id=log.officer_id,
            field_area_id=log.field_area_id,
            status=log.status,
            amount_collected=float(log.amount_collected),
            notes=log.notes,
            latitude=float(log.latitude) if log.latitude is not None else None,
            longitude=float(log.longitude) if log.longitude is not None else None,
            created_at=log.created_at,
        )
        for log in logs
    ]


@router.get("/reports", response_model=FieldOfficerReportResponse)
def get_field_officer_reports(
    db: Session = Depends(get_db),
    current_officer: Officer = Depends(get_current_officer),
):
    if current_officer.role not in ("FIELD_OFFICER", "SUPER_ADMIN"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="FIELD_OFFICER or SUPER_ADMIN role required.",
        )

    field_area_id = current_officer.field_area_id
    if field_area_id is None and current_officer.role == "SUPER_ADMIN":
        first_fa = db.scalars(
            select(FieldArea).where(FieldArea.is_active.is_(True))
        ).first()
        if first_fa:
            field_area_id = first_fa.id

    if field_area_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Field Officer is not assigned to any field area.",
        )

    field_area = db.get(FieldArea, field_area_id)
    fa_name = field_area.field_area_name if field_area else "Assigned Ward"

    # Assigned master meters and pending consumers in this ward
    assigned_meters = db.scalars(
        select(MasterMeter).where(MasterMeter.field_area_id == field_area_id)
    ).all()
    meter_ids = [m.meter_id for m in assigned_meters]

    pending_consumers = (
        db.scalars(
            select(PendingConsumer).where(PendingConsumer.meter_id.in_(meter_ids))
        ).all()
        if meter_ids
        else []
    )

    total_assigned_consumers = len(pending_consumers)
    total_outstanding = sum(float(c.pending_amount) for c in pending_consumers)

    # Officer visits
    visits = db.scalars(
        select(FieldVisitLog)
        .where(FieldVisitLog.officer_id == current_officer.id)
        .order_by(FieldVisitLog.created_at.desc())
    ).all()

    visited_consumer_ids = set(v.consumer_id for v in visits)
    total_visited_consumers = len(visited_consumer_ids)
    total_unvisited = max(0, total_assigned_consumers - total_visited_consumers)

    total_recovered = sum(
        float(v.amount_collected)
        for v in visits
        if v.status == "PAYMENT_RECOVERED"
    )

    total_pipeline = total_recovered + total_outstanding
    recovery_rate = (
        (total_recovered / total_pipeline * 100.0) if total_pipeline > 0 else 0.0
    )

    # Status Breakdown
    status_counts: dict[str, int] = {}
    for v in visits:
        status_counts[v.status] = status_counts.get(v.status, 0) + 1

    status_breakdown = [
        StatusCount(status=st, count=cnt) for st, cnt in status_counts.items()
    ]

    recent_responses = [
        VisitLogResponse(
            id=v.id,
            consumer_id=v.consumer_id,
            meter_id=v.meter_id,
            officer_id=v.officer_id,
            field_area_id=v.field_area_id,
            status=v.status,
            amount_collected=float(v.amount_collected),
            notes=v.notes,
            latitude=float(v.latitude) if v.latitude is not None else None,
            longitude=float(v.longitude) if v.longitude is not None else None,
            created_at=v.created_at,
        )
        for v in visits[:25]
    ]

    return FieldOfficerReportResponse(
        officer_name=current_officer.officer_name,
        officer_code=current_officer.officer_code,
        field_area_name=fa_name,
        total_assigned_consumers=total_assigned_consumers,
        total_visited_consumers=total_visited_consumers,
        total_unvisited_consumers=total_unvisited,
        total_recovered_amount=round(total_recovered, 2),
        total_outstanding_amount=round(total_outstanding, 2),
        recovery_rate_percentage=round(recovery_rate, 1),
        status_breakdown=status_breakdown,
        recent_visits=recent_responses,
    )

