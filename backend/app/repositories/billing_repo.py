import calendar
from datetime import date
from sqlalchemy import text
from sqlmodel.ext.asyncio.session import AsyncSession


def _period_bounds(period: str) -> tuple[date, date]:
    year, month = int(period[:4]), int(period[5:7])
    days = calendar.monthrange(year, month)[1]
    return date(year, month, 1), date(year, month, days)


class BillingRepo:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_room_billing_status(
        self, property_id: int, period: str, prev_period: str, next_period: str
    ) -> list[dict]:
        """Reading-entry view: only ACTIVE contracts.
        Readings for month M feed invoices for month M+1 — ended contracts have no future invoices.
        next_reading_locked = True when period N+1 already has a reading saved, meaning N cannot be edited.
        """
        result = await self.session.execute(text("""
            SELECT
                r.id          AS room_id,
                r.room_number,
                c.id          AS contract_id,
                c.agreed_rent,
                c.num_people,
                c.start_date  AS contract_start,
                c.end_date    AS contract_end,
                t.id          AS tenant_id,
                t.full_name   AS tenant_name,
                t.phone       AS tenant_phone,
                ur.id         AS reading_id,
                ur.elec_prev,
                ur.elec_curr,
                ur.water_prev,
                ur.water_curr,
                urp.elec_prev  AS prev_elec_prev,
                urp.elec_curr  AS prev_elec_curr,
                urp.water_prev AS prev_water_prev,
                urp.water_curr AS prev_water_curr,
                (urn.id IS NOT NULL) AS next_reading_locked,
                i.id          AS invoice_id,
                i.status      AS invoice_status,
                i.total       AS invoice_total,
                i.public_token
            FROM room r
            JOIN contract c ON c.room_id = r.id AND c.status = 'active'
            JOIN tenant t ON t.id = c.tenant_id
            LEFT JOIN utility_reading ur  ON ur.room_id = r.id AND ur.period = :period
            LEFT JOIN utility_reading urp ON urp.room_id = r.id AND urp.period = :prev_period
            LEFT JOIN utility_reading urn ON urn.room_id = r.id AND urn.period = :next_period
            LEFT JOIN invoice i ON i.contract_id = c.id AND i.period = :period
            WHERE r.property_id = :property_id
            ORDER BY r.room_number
        """), {"property_id": property_id, "period": period, "prev_period": prev_period, "next_period": next_period})
        return [dict(row) for row in result.mappings().all()]

    async def get_invoice_preview_data(self, property_id: int, period: str) -> list[dict]:
        """Invoice-generation view: active + recently-ended contracts.
        For rows with an existing invoice, stored invoice_item amounts are included
        so the preview shows the actual invoice figures rather than re-calculating
        from current rates (which may have changed since the invoice was created).
        """
        period_start, period_end = _period_bounds(period)
        result = await self.session.execute(text("""
            SELECT
                r.id          AS room_id,
                r.room_number,
                c.id          AS contract_id,
                c.agreed_rent,
                c.num_people,
                c.start_date  AS contract_start,
                c.end_date    AS contract_end,
                t.id          AS tenant_id,
                t.full_name   AS tenant_name,
                ur.id         AS reading_id,
                ur.elec_prev  AS elec_prev,
                ur.elec_curr  AS elec_curr,
                ur.water_prev AS water_prev,
                ur.water_curr AS water_curr,
                i.id          AS invoice_id,
                i.status      AS invoice_status,
                i.total       AS invoice_total,
                i.public_token AS invoice_public_token,
                ii.inv_rent,
                ii.inv_elec,
                ii.inv_water,
                ii.inv_shared_elec,
                ii.inv_surcharge
            FROM room r
            JOIN contract c ON c.room_id = r.id
                AND (
                    c.status = 'active'
                    OR (c.status = 'ended'
                        AND c.end_date >= :period_start
                        AND c.end_date <= :period_end)
                )
                AND c.start_date <= :period_end
            JOIN tenant t ON t.id = c.tenant_id
            LEFT JOIN utility_reading ur ON ur.room_id = r.id AND ur.period = :period
            LEFT JOIN invoice i ON i.contract_id = c.id AND i.period = :period
            LEFT JOIN (
                SELECT
                    invoice_id,
                    SUM(CASE WHEN item_type = 'rent'        THEN amount ELSE 0 END) AS inv_rent,
                    SUM(CASE WHEN item_type = 'electricity' THEN amount ELSE 0 END) AS inv_elec,
                    SUM(CASE WHEN item_type = 'water'       THEN amount ELSE 0 END) AS inv_water,
                    SUM(CASE WHEN item_type = 'shared_elec' THEN amount ELSE 0 END) AS inv_shared_elec,
                    SUM(CASE WHEN item_type = 'surcharge'   THEN amount ELSE 0 END) AS inv_surcharge
                FROM invoice_item
                GROUP BY invoice_id
            ) ii ON ii.invoice_id = i.id
            WHERE r.property_id = :property_id
            ORDER BY r.room_number
        """), {
            "property_id": property_id,
            "period": period,
            "period_start": period_start,
            "period_end": period_end,
        })
        return [dict(row) for row in result.mappings().all()]
