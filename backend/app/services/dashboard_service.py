from fastapi import Depends
from sqlalchemy import text
from sqlmodel.ext.asyncio.session import AsyncSession
from datetime import date, timedelta
from app.database import get_session
from app.schemas.dashboard import (
    DashboardSummary, DashboardRevenue,
    RoomStats, ExpiringContract, UnpaidInvoiceSummary, RevenueMonth,
)


class DashboardService:
    def __init__(self, session: AsyncSession = Depends(get_session)):
        self.session = session

    async def get_summary(self, clerk_user_id: str) -> DashboardSummary:
        # Properties
        r = await self.session.execute(
            text("SELECT COUNT(*) FROM property WHERE clerk_user_id = :uid"),
            {"uid": clerk_user_id},
        )
        prop_count: int = r.scalar_one()

        # Rooms by status
        r = await self.session.execute(text("""
            SELECT r.status, COUNT(*) AS cnt
            FROM room r
            JOIN property p ON p.id = r.property_id
            WHERE p.clerk_user_id = :uid
            GROUP BY r.status
        """), {"uid": clerk_user_id})
        room_map = {row.status: row.cnt for row in r.fetchall()}

        # Active contracts
        r = await self.session.execute(text("""
            SELECT COUNT(*) FROM contract c
            JOIN room r ON r.id = c.room_id
            JOIN property p ON p.id = r.property_id
            WHERE p.clerk_user_id = :uid AND c.status = 'active'
        """), {"uid": clerk_user_id})
        active_contracts: int = r.scalar_one()

        # Unpaid invoices (draft + sent)
        r = await self.session.execute(text("""
            SELECT COUNT(*), COALESCE(SUM(i.total), 0)
            FROM invoice i
            JOIN contract c ON c.id = i.contract_id
            JOIN room r ON r.id = c.room_id
            JOIN property p ON p.id = r.property_id
            WHERE p.clerk_user_id = :uid AND i.status IN ('draft', 'sent')
        """), {"uid": clerk_user_id})
        unpaid_row = r.one()
        unpaid_count = unpaid_row[0]
        unpaid_total = float(unpaid_row[1])

        # Expiring contracts — top 10 within 30 days
        today = date.today()
        in_30 = today + timedelta(days=30)
        r = await self.session.execute(text("""
            SELECT c.id, r.room_number, p.name AS property_name,
                   t.full_name AS tenant_name, c.end_date
            FROM contract c
            JOIN room r ON r.id = c.room_id
            JOIN property p ON p.id = r.property_id
            JOIN tenant t ON t.id = c.tenant_id
            WHERE p.clerk_user_id = :uid
              AND c.status = 'active'
              AND c.end_date BETWEEN :today AND :in30
            ORDER BY c.end_date ASC
            LIMIT 10
        """), {"uid": clerk_user_id, "today": today, "in30": in_30})
        expiring_rows = r.fetchall()
        expiring_contracts = [
            ExpiringContract(
                contract_id=row.id,
                room_number=row.room_number,
                property_name=row.property_name,
                tenant_name=row.tenant_name,
                end_date=str(row.end_date),
                days_left=(row.end_date - today).days,
            )
            for row in expiring_rows
        ]

        # Top 10 unpaid invoice details
        r = await self.session.execute(text("""
            SELECT i.id, r.room_number, p.name AS property_name,
                   t.full_name AS tenant_name, i.period, i.total, i.status
            FROM invoice i
            JOIN contract c ON c.id = i.contract_id
            JOIN room r ON r.id = c.room_id
            JOIN property p ON p.id = r.property_id
            JOIN tenant t ON t.id = c.tenant_id
            WHERE p.clerk_user_id = :uid AND i.status IN ('draft', 'sent')
            ORDER BY i.period DESC
            LIMIT 10
        """), {"uid": clerk_user_id})
        unpaid_list = [
            UnpaidInvoiceSummary(
                invoice_id=row.id,
                room_number=row.room_number,
                property_name=row.property_name,
                tenant_name=row.tenant_name,
                period=row.period,
                total=float(row.total),
                status=row.status,
            )
            for row in r.fetchall()
        ]

        return DashboardSummary(
            properties=prop_count,
            rooms=RoomStats(
                total=sum(room_map.values()),
                vacant=room_map.get("vacant", 0),
                occupied=room_map.get("occupied", 0),
                maintenance=room_map.get("maintenance", 0),
            ),
            active_contracts=active_contracts,
            unpaid_invoices=unpaid_count,
            unpaid_total=unpaid_total,
            expiring_soon=len(expiring_contracts),
            expiring_contracts=expiring_contracts,
            unpaid_invoice_list=unpaid_list,
        )

    async def get_revenue(self, clerk_user_id: str, year: int) -> DashboardRevenue:
        r = await self.session.execute(text("""
            SELECT i.period, COALESCE(SUM(i.total), 0) AS total
            FROM invoice i
            JOIN contract c ON c.id = i.contract_id
            JOIN room r ON r.id = c.room_id
            JOIN property p ON p.id = r.property_id
            WHERE p.clerk_user_id = :uid
              AND i.status = 'paid'
              AND i.period LIKE :prefix
            GROUP BY i.period
            ORDER BY i.period
        """), {"uid": clerk_user_id, "prefix": f"{year}-%"})

        month_map = {row.period: float(row.total) for row in r.fetchall()}
        months = [
            RevenueMonth(
                month=f"{year}-{str(m).zfill(2)}",
                total=month_map.get(f"{year}-{str(m).zfill(2)}", 0.0),
            )
            for m in range(1, 13)
        ]

        return DashboardRevenue(
            year=year,
            months=months,
            total_year=sum(m.total for m in months),
        )
