from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.services.zone_storage import list_active_zones

router = APIRouter(
    prefix="/zones",
    tags=["Zones"],
)


class ZoneResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    zone_code: str
    zone_name: str
    is_active: bool


@router.get(
    "",
    response_model=list[ZoneResponse],
)
def list_zones_api(
    db: Session = Depends(get_db),
):
    return list_active_zones(db)
