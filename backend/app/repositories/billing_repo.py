from sqlalchemy import text
from sqlmodel.ext.asyncio.session import AsyncSession


class BillingRepo:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_room_billing_status(self, property_id: int, period: str) -> list[dict]:
        """
        For each room with an active contract, return combined status:
        room info, tenant info, reading for this period, invoice for this period.
        """
        result = await self.session.execute(text("""
            SELECT
                r.id          AS room_id,
                r.room_number,
                r.elec_rate   AS room_elec_rate,
                c.id          AS contract_id,
                c.agreed_rent,
                c.num_people,
                t.id          AS tenant_id,
                t.full_name   AS tenant_name,
                t.phone       AS tenant_phone,
                ur.id         AS reading_id,
                ur.elec_prev,
                ur.elec_curr,
                ur.water_prev,
                ur.water_curr,
                i.id          AS invoice_id,
                i.status      AS invoice_status,
                i.total       AS invoice_total,
                i.public_token
            FROM room r
            JOIN contract c  ON c.room_id = r.id AND c.status = 'active'
            JOIN tenant  t   ON t.id = c.tenant_id
            LEFT JOIN utility_reading ur ON ur.room_id = r.id AND ur.period = :period
            LEFT JOIN invoice         i  ON i.contract_id = c.id AND i.period = :period
            WHERE r.property_id = :property_id
            ORDER BY r.room_number
        """), {"property_id": property_id, "period": period})
        return [dict(row._mapping) for row in result]
