from dataclasses import dataclass
from decimal import Decimal

from geoalchemy2 import functions as geo_func
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.master_meter import MasterMeter
from app.models.pending_consumer import PendingConsumer


@dataclass
class PendingConsumerMatch:
    consumer_id: str
    consumer_name: str
    meter_id: str
    pending_amount: Decimal
    days_pending: int
    matched: bool
    latitude: float | None
    longitude: float | None


def match_pending_consumers(
    db: Session,
) -> list[PendingConsumerMatch]:
    """
    Match pending consumers to master meters using meter_id.

    Uses one LEFT JOIN query.

    PostGIS performs coordinate extraction directly:
        ST_Y(location) -> latitude
        ST_X(location) -> longitude
    """

    latitude = geo_func.ST_Y(MasterMeter.location).label(
        "latitude"
    )

    longitude = geo_func.ST_X(MasterMeter.location).label(
        "longitude"
    )

    stmt = (
        select(
            PendingConsumer.consumer_id,
            PendingConsumer.consumer_name,
            PendingConsumer.meter_id,
            PendingConsumer.pending_amount,
            PendingConsumer.days_pending,
            MasterMeter.meter_id.label("master_meter_id"),
            latitude,
            longitude,
        )
        .outerjoin(
            MasterMeter,
            PendingConsumer.meter_id == MasterMeter.meter_id,
        )
        .order_by(PendingConsumer.id)
    )

    rows = db.execute(stmt).all()

    results: list[PendingConsumerMatch] = []

    for row in rows:
        results.append(
            PendingConsumerMatch(
                consumer_id=row.consumer_id,
                consumer_name=row.consumer_name,
                meter_id=row.meter_id,
                pending_amount=row.pending_amount,
                days_pending=row.days_pending,
                matched=row.master_meter_id is not None,
                latitude=(
                    float(row.latitude)
                    if row.latitude is not None
                    else None
                ),
                longitude=(
                    float(row.longitude)
                    if row.longitude is not None
                    else None
                ),
            )
        )

    return results


def summarize_matches(
    matches: list[PendingConsumerMatch],
) -> dict[str, int]:
    matched = sum(
        1
        for item in matches
        if item.matched
    )

    unmatched = len(matches) - matched

    return {
        "total": len(matches),
        "matched": matched,
        "unmatched": unmatched,
    }