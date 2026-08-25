from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.master_meter import MasterMeter


router = APIRouter(
    prefix="/meters",
    tags=["Meters"],
)


@router.get("/count")
def meter_count(db: Session = Depends(get_db)):
    count = db.scalar(
        select(func.count()).select_from(MasterMeter)
    )

    return {"count": count}