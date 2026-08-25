"""
Seed Nagpur Geographic Hierarchy, Role Accounts, Master Meters, and Pending Consumers.
Creates 1 User Account for each Role (SUPER_ADMIN, ZONAL_ADMIN, AREA_ADMIN, FIELD_OFFICER).
"""
import sys
import os
import csv
from datetime import datetime
from pathlib import Path

# Add app to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.db.session import SessionLocal
from app.models.zone import Zone
from app.models.area import Area
from app.models.field_area import FieldArea
from app.models.officer import Officer
from app.models.master_meter import MasterMeter
from app.models.pending_consumer import PendingConsumer
from app.services.officer_storage import create_officer, get_officer_by_email
from sqlalchemy import text


def seed_nagpur():
    db = SessionLocal()
    try:
        print("=== 1. Creating Nagpur Geographic Hierarchy ===")
        # Zone: Nagpur Zone
        zone = db.query(Zone).filter((Zone.zone_code == "MH-NGP-ZONE") | (Zone.zone_name == "Nagpur Zone")).first()
        if not zone:
            zone = Zone(
                zone_code="MH-NGP-ZONE",
                zone_name="Nagpur Zone",
                is_active=True,
            )
            db.add(zone)
            db.flush()
            print(f"Created Zone: {zone.zone_name} ({zone.zone_code}) - ID: {zone.id}")
        else:
            print(f"Zone already exists: {zone.zone_name} ({zone.zone_code}) - ID: {zone.id}")

        # Area: Nagpur Central Area
        area = db.query(Area).filter(Area.area_code == "MH-NGP-AREA1").first()
        if not area:
            area = Area(
                zone_id=zone.id,
                area_code="MH-NGP-AREA1",
                area_name="Nagpur Central Area",
                is_active=True,
            )
            db.add(area)
            db.flush()
            print(f"Created Area: {area.area_name} ({area.area_code}) - ID: {area.id}")
        else:
            print(f"Area already exists: {area.area_name}")

        # Field Area (Ward): Sitabuldi & Dharampeth Ward
        field_area = db.query(FieldArea).filter(FieldArea.field_area_code == "MH-NGP-WARD1").first()
        if not field_area:
            field_area = FieldArea(
                area_id=area.id,
                field_area_code="MH-NGP-WARD1",
                field_area_name="Sitabuldi & Dharampeth Ward",
                is_active=True,
            )
            db.add(field_area)
            db.flush()
            print(f"Created Field Area: {field_area.field_area_name} ({field_area.field_area_code}) - ID: {field_area.id}")
        else:
            print(f"Field Area already exists: {field_area.field_area_name}")

        print("\n=== 2. Creating User Accounts for All Roles ===")
        # 1. SUPER_ADMIN
        sa = get_officer_by_email(db, "superadmin@maharashtra.gov.in")
        if not sa:
            sa = create_officer(
                db,
                officer_code="MH-SUPER-001",
                officer_name="Maharashtra State Super Admin",
                email="superadmin@maharashtra.gov.in",
                phone="9999999999",
                password="SuperAdmin@12345",
                role="SUPER_ADMIN",
                is_active=True,
            )
            print(f"Created Super Admin: {sa.email}")
        else:
            print(f"Super Admin exists: {sa.email}")

        # 2. ZONAL_ADMIN (Assigned to Nagpur Zone)
        za = get_officer_by_email(db, "zonal.nagpur@maharashtra.gov.in")
        if not za:
            za = create_officer(
                db,
                officer_code="MH-NGP-ZA-001",
                officer_name="Nagpur Zonal Admin",
                email="zonal.nagpur@maharashtra.gov.in",
                phone="9822001122",
                password="ZonalAdmin@12345",
                role="ZONAL_ADMIN",
                zone_id=zone.id,
                is_active=True,
            )
            print(f"Created Zonal Admin: {za.email} (Zone: {zone.zone_name})")
        else:
            za.zone_id = zone.id
            db.commit()
            print(f"Zonal Admin exists: {za.email}")

        # 3. AREA_ADMIN (Assigned to Nagpur Central Area)
        aa = get_officer_by_email(db, "area.nagpur@maharashtra.gov.in")
        if not aa:
            aa = create_officer(
                db,
                officer_code="MH-NGP-AA-001",
                officer_name="Nagpur Central Area Admin",
                email="area.nagpur@maharashtra.gov.in",
                phone="9822003344",
                password="AreaAdmin@12345",
                role="AREA_ADMIN",
                area_id=area.id,
                is_active=True,
            )
            print(f"Created Area Admin: {aa.email} (Area: {area.area_name})")
        else:
            aa.area_id = area.id
            db.commit()
            print(f"Area Admin exists: {aa.email}")

        # 4. FIELD_OFFICER (Assigned to Sitabuldi & Dharampeth Ward)
        fo = get_officer_by_email(db, "officer.nagpur@maharashtra.gov.in")
        if not fo:
            fo = create_officer(
                db,
                officer_code="MH-NGP-FO-001",
                officer_name="Nagpur Field Officer",
                email="officer.nagpur@maharashtra.gov.in",
                phone="9822005566",
                password="FieldOfficer@12345",
                role="FIELD_OFFICER",
                field_area_id=field_area.id,
                is_active=True,
            )
            print(f"Created Field Officer: {fo.email} (Ward: {field_area.field_area_name})")
        else:
            fo.field_area_id = field_area.id
            db.commit()
            print(f"Field Officer exists: {fo.email}")

        print("\n=== 3. Seeding Nagpur Master Meters ===")
        csv_path = Path(__file__).resolve().parent.parent.parent.parent / "data" / "nagpur_master_meters.csv"
        if csv_path.exists():
            with open(csv_path, "r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                count = 0
                for row in reader:
                    meter_id = row.get("meter_id", "").strip()
                    if not meter_id:
                        continue
                    existing_meter = db.query(MasterMeter).filter(MasterMeter.meter_id == meter_id).first()
                    lat = float(row.get("latitude", 0))
                    lon = float(row.get("longitude", 0))
                    cust_name = row.get("customer_name", "").strip()
                    cust_id = row.get("customer_id", "").strip() or f"CUST-{meter_id}"

                    if not existing_meter:
                        now = datetime.utcnow()
                        meter = MasterMeter(
                            zone_id=zone.id,
                            area_id=area.id,
                            field_area_id=field_area.id,
                            meter_id=meter_id,
                            customer_id=cust_id,
                            customer_name=cust_name,
                            location=f"POINT({lon} {lat})",
                            created_at=now,
                            updated_at=now,
                        )
                        db.add(meter)
                        count += 1
                db.commit()
                print(f"Seeded {count} Master Meters into {field_area.field_area_name}.")

        print("\n=== 4. Seeding Initial Nagpur Pending Consumers ===")
        pending_csv = Path(__file__).resolve().parent.parent.parent.parent / "data" / "nagpur_pending_consumers.csv"
        if pending_csv.exists():
            with open(pending_csv, "r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                pcount = 0
                for row in reader:
                    cid = row.get("consumer_id", "").strip()
                    cname = row.get("consumer_name", "").strip()
                    mid = row.get("meter_id", "").strip()
                    amt = float(row.get("pending_amount", 0))
                    days = int(row.get("days_pending", 0))

                    if not cid or not mid:
                        continue

                    existing_pc = db.query(PendingConsumer).filter(PendingConsumer.consumer_id == cid).first()
                    if not existing_pc:
                        pc = PendingConsumer(
                            consumer_id=cid,
                            consumer_name=cname,
                            meter_id=mid,
                            pending_amount=amt,
                            days_pending=days,
                        )
                        db.add(pc)
                        pcount += 1
                db.commit()
                print(f"Seeded {pcount} Pending Consumers.")

        db.commit()
        print("\nNagpur environment setup complete!")

    finally:
        db.close()


if __name__ == "__main__":
    seed_nagpur()
