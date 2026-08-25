"""
Seed Maharashtra Zones.
Creates the standard MSEDCL (Mahavitaran) administrative zones for Maharashtra.
Safe to re-run — skips zones that already exist by zone_code.
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.session import get_db
from app.models.zone import Zone

MAHARASHTRA_ZONES = [
    {"zone_code": "MH-PUNE",    "zone_name": "Pune Zone"},
    {"zone_code": "MH-NAGPUR",  "zone_name": "Nagpur Zone"},
    {"zone_code": "MH-MUMBAI",  "zone_name": "Mumbai Zone"},
    {"zone_code": "MH-NASHIK",  "zone_name": "Nashik Zone"},
    {"zone_code": "MH-AURANG",  "zone_name": "Aurangabad Zone"},
    {"zone_code": "MH-AMRAV",   "zone_name": "Amravati Zone"},
    {"zone_code": "MH-KONKAN",  "zone_name": "Konkan Zone"},
    {"zone_code": "MH-LATUR",   "zone_name": "Latur Zone"},
]

def main():
    db = next(get_db())

    created = 0
    skipped = 0

    for zone_data in MAHARASHTRA_ZONES:
        existing = (
            db.query(Zone)
            .filter(Zone.zone_code == zone_data["zone_code"])
            .first()
        )

        if existing:
            print(f"  SKIP  {zone_data['zone_code']} — already exists.")
            skipped += 1
            continue

        zone = Zone(
            zone_code=zone_data["zone_code"],
            zone_name=zone_data["zone_name"],
            is_active=True,
        )

        db.add(zone)
        db.flush()

        print(f"  CREATE {zone.zone_code} — {zone.zone_name} (id={zone.id})")
        created += 1

    db.commit()
    print(f"\nDone: {created} created, {skipped} skipped.")


if __name__ == "__main__":
    main()
