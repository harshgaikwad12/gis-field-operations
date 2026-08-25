"""
Seed Area Admin and Area/Field Area dependencies.
Creates a default Area Admin with email areaadmin@maharashtra.gov.in
and password AreaAdmin@12345 assigned to Nagpur Central Area.
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.session import get_db
from app.models.zone import Zone
from app.models.area import Area
from app.models.field_area import FieldArea
from app.models.officer import Officer
from app.services.officer_storage import hash_password

def main():
    db = next(get_db())

    # 1. Resolve Nagpur Zone (MH-NAGPUR)
    zone = db.query(Zone).filter(Zone.zone_code == "MH-NAGPUR").first()
    if not zone:
        print("Nagpur Zone not found! Seeding Nagpur Zone first...")
        zone = Zone(zone_code="MH-NAGPUR", zone_name="Nagpur Zone", is_active=True)
        db.add(zone)
        db.flush()

    # 2. Create Area: Nagpur Central Area (MH-NGP-CENTRAL)
    area = db.query(Area).filter(Area.area_code == "MH-NGP-CENTRAL").first()
    if not area:
        area = Area(
            area_code="MH-NGP-CENTRAL",
            area_name="Nagpur Central Area",
            zone_id=zone.id,
            is_active=True,
        )
        db.add(area)
        db.flush()
        print(f"Created Area: {area.area_name} (id={area.id})")
    else:
        print(f"Area {area.area_code} already exists.")

    # 3. Create Field Areas
    field_areas = [
        {"code": "MH-NGP-WARD1", "name": "Nagpur Ward 1"},
        {"code": "MH-NGP-WARD2", "name": "Nagpur Ward 2"},
        {"code": "MH-NGP-WARD3", "name": "Nagpur Ward 3"},
    ]

    for fa_data in field_areas:
        fa = db.query(FieldArea).filter(FieldArea.field_area_code == fa_data["code"]).first()
        if not fa:
            fa = FieldArea(
                field_area_code=fa_data["code"],
                field_area_name=fa_data["name"],
                area_id=area.id,
                is_active=True,
            )
            db.add(fa)
            print(f"Created Field Area: {fa.field_area_name}")
        else:
            print(f"Field Area {fa.field_area_code} already exists.")
    
    db.flush()

    # 4. Create Area Admin Officer (areaadmin@maharashtra.gov.in)
    email = "areaadmin@maharashtra.gov.in"
    officer = db.query(Officer).filter(Officer.email == email).first()
    if not officer:
        officer = Officer(
            officer_code="AA001",
            officer_name="Nagpur Area Admin",
            email=email,
            phone="9876543212",
            role="AREA_ADMIN",
            password_hash=hash_password("AreaAdmin@12345"),
            zone_id=zone.id,
            area_id=area.id,
            is_active=True,
        )
        db.add(officer)
        print(f"Created Area Admin: {officer.officer_name} ({officer.email})")
    else:
        # Make sure they have the right role, zone_id, and area_id
        officer.role = "AREA_ADMIN"
        officer.zone_id = zone.id
        officer.area_id = area.id
        print(f"Area Admin {officer.email} already exists. Updated scope.")

    db.commit()
    print("Done seeding Area Admin dependencies!")

if __name__ == "__main__":
    main()
