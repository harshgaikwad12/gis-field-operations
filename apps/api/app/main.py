from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.v1.meters import router as meters_router
from app.api.v1.master_meters import router as master_meters_router
from app.api.v1.pending_consumers import (
    router as pending_consumers_router,
)
from app.api.v1.officers import router as officers_router
from app.api.v1.auth import router as auth_router
from app.api.v1.admin_dashboard import (
    router as admin_dashboard_router,
)
from app.api.v1.zones import router as zones_router
from app.api.v1.areas import router as areas_router
from app.api.v1.super_admin import (
    router as super_admin_router,
)
from app.api.v1.area_admin import (
    router as area_admin_router,
)
from app.api.v1.field_officer import (
    router as field_officer_router,
)
from app.db.base import Base
from app.db.session import engine, get_db
import app.models  # Ensure all models are registered

# Create newly declared tables if they do not exist
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="GIS Field Operations API",
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://web-delta-one-29.vercel.app",
        "https://web-lk6cbfic1-hng5.vercel.app",
        "https://web-r3kmg5t6f-hng5.vercel.app",
        "https://web-3wyx18rj4-hng5.vercel.app",
    ],
    allow_origin_regex=r"^https:\/\/.*\.vercel\.app$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(
    super_admin_router,
    prefix="/api/v1",
)

app.include_router(
    area_admin_router,
    prefix="/api/v1",
)

app.include_router(
    field_officer_router,
    prefix="/api/v1",
)

app.include_router(
    admin_dashboard_router,
    prefix="/api/v1",
)

app.include_router(
    zones_router,
    prefix="/api/v1",
)

app.include_router(
    areas_router,
    prefix="/api/v1",
)

app.include_router(
    meters_router,
    prefix="/api/v1",
)

app.include_router(
    master_meters_router,
    prefix="/api/v1",
)

app.include_router(
    pending_consumers_router,
    prefix="/api/v1",
)

app.include_router(
    officers_router,
    prefix="/api/v1",
)

app.include_router(
    auth_router,
    prefix="/api/v1",
)


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.get("/health/database")
def database_health(
    db: Session = Depends(get_db),
):
    db.execute(text("SELECT 1"))

    return {
        "status": "ok",
        "database": "connected",
    }