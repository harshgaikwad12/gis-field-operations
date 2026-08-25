from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
)
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.auth import (
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES,
    create_access_token,
)
from app.core.authorization import get_current_officer
from app.db.session import get_db
from app.models.officer import Officer
from app.services.officer_storage import (
    authenticate_officer,
)


router = APIRouter(
    prefix="/auth",
    tags=["Authentication"],
)


# ============================================================
# REQUEST / RESPONSE SCHEMAS
# ============================================================


class LoginRequest(BaseModel):
    email: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str
    expires_in: int


class CurrentOfficerResponse(BaseModel):
    id: int
    officer_code: str
    officer_name: str
    role: str
    is_active: bool


# ============================================================
# LOGIN
# ============================================================


@router.post(
    "/login",
    response_model=LoginResponse,
)
def login(
    payload: LoginRequest,
    db: Session = Depends(get_db),
):
    officer = authenticate_officer(
        db,
        email=payload.email,
        password=payload.password,
    )

    if officer is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
            headers={
                "WWW-Authenticate": "Bearer",
            },
        )

    access_token = create_access_token(
        officer_id=officer.id,
        officer_code=officer.officer_code,
        role=officer.role,
    )

    return LoginResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in=(
            JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60
        ),
    )


# ============================================================
# CURRENT OFFICER
# ============================================================


@router.get(
    "/me",
    response_model=CurrentOfficerResponse,
)
def current_officer(
    officer: Officer = Depends(
        get_current_officer
    ),
):
    return CurrentOfficerResponse(
        id=officer.id,
        officer_code=officer.officer_code,
        officer_name=officer.officer_name,
        role=officer.role,
        is_active=officer.is_active,
    )