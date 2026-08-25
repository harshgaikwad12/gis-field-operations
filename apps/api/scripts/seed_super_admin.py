import sys
from pathlib import Path

# Add app to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.db.session import SessionLocal
from app.models.officer import Officer
from app.services.officer_storage import create_officer, get_officer_by_email


def seed_super_admin():
    db = SessionLocal()
    try:
        existing = get_officer_by_email(db, "superadmin@maharashtra.gov.in")
        if existing:
            if existing.role != "SUPER_ADMIN":
                existing.role = "SUPER_ADMIN"
                db.commit()
                print("Updated existing officer to SUPER_ADMIN role.")
            else:
                print("Super Admin account already exists.")
            return

        super_admin = create_officer(
            db,
            officer_code="MH-SUPER-001",
            officer_name="Maharashtra State Super Admin",
            email="superadmin@maharashtra.gov.in",
            phone="9999999999",
            password="SuperAdmin@12345",
            role="SUPER_ADMIN",
            is_active=True,
        )
        print(f"Created Super Admin officer: {super_admin.officer_name} ({super_admin.email})")

    finally:
        db.close()


if __name__ == "__main__":
    seed_super_admin()
