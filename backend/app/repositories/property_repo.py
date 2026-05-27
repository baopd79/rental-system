from typing import Any
from sqlalchemy import text
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from app.models.property import Property


class PropertyRepo:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_all(self, clerk_user_id: str) -> list[Property]:
        """Lấy tất cả property thuộc user."""
        result = await self.session.exec(
            select(Property).where(Property.clerk_user_id == clerk_user_id)
        )
        return list(result.all())

    async def get_by_id(self, property_id: int) -> Property | None:
        """Lấy property theo PK, dùng identity map cache. Trả None nếu không tìm thấy."""
        return await self.session.get(Property, property_id)

    async def get_by_name(self, clerk_user_id: str, name: str) -> Property | None:
        """Tìm property theo tên trong phạm vi user — dùng để check trùng tên trước khi tạo."""
        result = await self.session.exec(
            select(Property).where(
                Property.clerk_user_id == clerk_user_id, Property.name == name
            )
        )
        return result.first()

    async def create(self, prop: Property) -> Property:
        """Thêm property mới, flush để ID available ngay trong transaction hiện tại."""
        self.session.add(prop)
        await self.session.flush()
        return prop

    async def update(self, prop: Property) -> Property:
        """Lưu thay đổi của property đã tracked trong session."""
        self.session.add(prop)
        await self.session.flush()
        return prop

    async def delete(self, prop: Property) -> None:
        """Xóa property khỏi DB trong transaction hiện tại."""
        await self.session.delete(prop)
        await self.session.flush()

    async def get_stats(self, clerk_user_id: str, period: str) -> list[Any]:
        """Trả tổng phòng, phòng đang thuê và doanh thu tháng `period` cho từng property."""
        result = await self.session.exec(
            text("""
            SELECT
                p.id,
                COUNT(r.id)                                          AS total_rooms,
                COUNT(CASE WHEN r.status = 'occupied' THEN 1 END)   AS occupied_rooms,
                COALESCE((
                    SELECT SUM(i.total)
                    FROM invoice i
                    JOIN contract c2 ON c2.id = i.contract_id
                    JOIN room r2 ON r2.id = c2.room_id
                    WHERE r2.property_id = p.id
                      AND i.status = 'paid'
                      AND i.period = :period
                ), 0) AS monthly_revenue
            FROM property p
            LEFT JOIN room r ON r.property_id = p.id
            WHERE p.clerk_user_id = :uid
            GROUP BY p.id
            ORDER BY p.id
            """),
            params={"uid": clerk_user_id, "period": period},
        )
        return list(result.fetchall())
