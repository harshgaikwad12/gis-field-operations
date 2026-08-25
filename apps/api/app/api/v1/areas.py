from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from app.core.authorization import get_current_officer
from app.db.session import get_db
from app.models.officer import Officer
from app.services.area_storage import list_active_areas


router = APIRouter(
    prefix="/areas",
    tags=["Areas"],
)


class AreaResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    area_code: str
    area_name: str
    zone_id: int
    is_active: bool


@router.get(
    "",
    response_model=list[AreaResponse],
)
def list_areas_api(
    zone_id: int | None = Query(None),
    db: Session = Depends(get_db),
    current_officer: Officer = Depends(get_current_officer),
):
    target_zone_id = zone_id
    if current_officer.role == "ADMIN" and current_officer.zone_id is not None:
        target_zone_id = current_officer.zone_id

    areas = list_active_areas(
        db,
        zone_id=target_zone_id,
    )

    return areas
