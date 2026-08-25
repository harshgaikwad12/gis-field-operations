from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.services.pending_consumer_import import (
    validate_pending_consumer_file,
)
from app.services.pending_consumer_storage import (
    store_pending_consumers,
)
from app.services.pending_consumer_matching import (
    match_pending_consumers,
    summarize_matches,
)


router = APIRouter(
    prefix="/pending-consumers",
    tags=["Pending Consumers"],
)


@router.post("/upload")
async def upload_pending_consumer_file(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    if not file.filename:
        raise HTTPException(
            status_code=400,
            detail="File is required.",
        )

    filename = file.filename.lower()

    if not filename.endswith((".csv", ".xlsx")):
        raise HTTPException(
            status_code=400,
            detail="Only CSV and XLSX files are supported.",
        )

    content = await file.read()

    if not content:
        raise HTTPException(
            status_code=400,
            detail="Uploaded file is empty.",
        )

    try:
        rows, errors = validate_pending_consumer_file(
            file.filename,
            content,
        )

    except UnicodeDecodeError as exc:
        raise HTTPException(
            status_code=400,
            detail="CSV file must use UTF-8 encoding.",
        ) from exc

    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc

    if errors:
        raise HTTPException(
            status_code=422,
            detail={
                "message": (
                    "File validation failed. "
                    "No records were imported."
                ),
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
        result = store_pending_consumers(
            db,
            rows,
        )

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail="Database import failed.",
        ) from exc

    return {
        "status": "imported",
        "filename": file.filename,
        "rows": len(rows),
        "inserted": result["inserted"],
        "updated": result["updated"],
        "message": "File imported successfully.",
    }


@router.get("/matched")
def get_matched_pending_consumers(
    db: Session = Depends(get_db),
):
    matches = match_pending_consumers(db)

    summary = summarize_matches(matches)

    return {
        **summary,
        "consumers": [
            {
                "consumer_id": item.consumer_id,
                "consumer_name": item.consumer_name,
                "meter_id": item.meter_id,
                "pending_amount": float(
                    item.pending_amount
                ),
                "days_pending": item.days_pending,
                "matched": item.matched,
                "latitude": item.latitude,
                "longitude": item.longitude,
            }
            for item in matches
        ],
    }