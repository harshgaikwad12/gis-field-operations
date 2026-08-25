from dataclasses import dataclass

from fastapi import HTTPException, status

from app.models.officer import Officer


@dataclass(frozen=True)
class OfficerScope:
    zone_id: int
    area_id: int | None
    field_area_id: int | None


def get_officer_scope(
    officer: Officer,
) -> OfficerScope:
    if officer.zone_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Officer is not assigned to a zone.",
        )

    role = officer.role.upper()

    if role == "ADMIN":
        if officer.area_id is not None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="ADMIN cannot be assigned to an area.",
            )

        if officer.field_area_id is not None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="ADMIN cannot be assigned to a field area.",
            )

        return OfficerScope(
            zone_id=officer.zone_id,
            area_id=None,
            field_area_id=None,
        )

    if role == "AREA_ADMIN":
        if officer.area_id is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="AREA_ADMIN must be assigned to an area.",
            )

        if officer.field_area_id is not None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="AREA_ADMIN cannot be assigned to a field area.",
            )

        return OfficerScope(
            zone_id=officer.zone_id,
            area_id=officer.area_id,
            field_area_id=None,
        )

    if role == "FIELD_OFFICER":
        if officer.area_id is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="FIELD_OFFICER must be assigned to an area.",
            )

        if officer.field_area_id is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="FIELD_OFFICER must be assigned to a field area.",
            )

        return OfficerScope(
            zone_id=officer.zone_id,
            area_id=officer.area_id,
            field_area_id=officer.field_area_id,
        )

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Officer role does not have a valid geographical scope.",
    )