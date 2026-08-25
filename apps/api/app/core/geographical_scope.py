from fastapi import HTTPException, status

from app.core.scope import OfficerScope


def require_zone_access(
    scope: OfficerScope,
    zone_id: int,
) -> None:
    if scope.zone_id != zone_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Officer does not have access to this zone.",
        )


def require_area_access(
    scope: OfficerScope,
    zone_id: int,
    area_id: int,
) -> None:
    if scope.zone_id != zone_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Officer does not have access to this zone.",
        )

    if scope.area_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Officer does not have area-level access.",
        )

    if scope.area_id != area_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Officer does not have access to this area.",
        )


def require_field_area_access(
    scope: OfficerScope,
    zone_id: int,
    area_id: int,
    field_area_id: int,
) -> None:
    if scope.zone_id != zone_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Officer does not have access to this zone.",
        )

    if scope.area_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Officer does not have area-level access.",
        )

    if scope.area_id != area_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Officer does not have access to this area.",
        )

    if scope.field_area_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Officer does not have field-area-level access.",
        )

    if scope.field_area_id != field_area_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Officer does not have access to this field area.",
        )
