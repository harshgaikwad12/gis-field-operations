from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    UploadFile,
    status,
)
from sqlalchemy.orm import Session

from app.core.authorization import require_permission
from app.core.rbac import Permission
from app.db.session import get_db
from app.models.officer import Officer
from app.services.master_meter_import import (
    validate_master_meter_file,
)
from app.services.master_meter_storage import (
    upsert_master_meters,
)


router = APIRouter(
    prefix="/master-meters",
    tags=["Master Meters"],
)


# ============================================================
# UPLOAD MASTER METER FILE
# ============================================================


@router.post(
    "/upload",
    status_code=status.HTTP_200_OK,
)
async def upload_master_meter_file(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_officer: Officer = Depends(
        require_permission(
            Permission.MANAGE_MASTER_METERS
        )
    ),
):
    """
    Upload master-meter data from CSV or XLSX.

    Access:
        ADMIN only.

    The uploaded file is validated before any database
    changes are made.
    """

    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File is required.",
        )

    filename = file.filename.lower()

    if not filename.endswith(
        (".csv", ".xlsx")
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Only CSV and XLSX files are supported."
            ),
        )

    content = await file.read()

    if not content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty.",
        )

    # --------------------------------------------------------
    # VALIDATE FILE
    # --------------------------------------------------------

    try:
        rows, errors = validate_master_meter_file(
            file.filename,
            content,
        )

    except UnicodeDecodeError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "CSV file must use UTF-8 encoding."
            ),
        ) from exc

    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    # --------------------------------------------------------
    # VALIDATION ERRORS
    # --------------------------------------------------------

    if errors:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
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

    # --------------------------------------------------------
    # DATABASE UPSERT
    # --------------------------------------------------------

    try:
        result = upsert_master_meters(
            db=db,
            rows=rows,
            zone_id=current_officer.zone_id,
        )

    except Exception as exc:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=(
                "Database update failed. "
                "No records were imported."
            ),
        ) from exc

    # --------------------------------------------------------
    # SUCCESS
    # --------------------------------------------------------

    return {
        "status": "imported",
        "filename": file.filename,
        "rows": result["total"],
        "inserted": result["inserted"],
        "updated": result["updated"],
        "message": (
            "Master meter import successful."
        ),
    }