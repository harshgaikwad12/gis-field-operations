from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.pending_consumer import PendingConsumer


def store_pending_consumers(
    db: Session,
    rows: list[dict[str, str]],
) -> dict[str, int]:
    inserted = 0
    updated = 0

    try:
        for row in rows:
            consumer_id = row["consumer_id"].strip()

            existing = db.scalar(
                select(PendingConsumer).where(
                    PendingConsumer.consumer_id == consumer_id
                )
            )

            if existing:
                existing.consumer_name = row["consumer_name"].strip()
                existing.meter_id = row["meter_id"].strip()
                existing.pending_amount = Decimal(
                    row["pending_amount"].strip()
                )
                existing.days_pending = int(
                    row["days_pending"].strip()
                )
                updated += 1

            else:
                db.add(
                    PendingConsumer(
                        consumer_id=consumer_id,
                        consumer_name=row["consumer_name"].strip(),
                        meter_id=row["meter_id"].strip(),
                        pending_amount=Decimal(
                            row["pending_amount"].strip()
                        ),
                        days_pending=int(
                            row["days_pending"].strip()
                        ),
                    )
                )
                inserted += 1

        db.commit()

        return {
            "inserted": inserted,
            "updated": updated,
        }

    except Exception:
        db.rollback()
        raise