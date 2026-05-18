from fastapi import APIRouter, Query
from app.dependencies import CurrentUserDep, DashboardServiceDep
from app.schemas.dashboard import DashboardSummary, DashboardRevenue
from datetime import date

router = APIRouter(tags=["dashboard"])


@router.get("/dashboard/summary", response_model=DashboardSummary)
async def get_summary(
    clerk_user_id: CurrentUserDep,
    service: DashboardServiceDep,
) -> DashboardSummary:
    return await service.get_summary(clerk_user_id)


@router.get("/dashboard/revenue", response_model=DashboardRevenue)
async def get_revenue(
    clerk_user_id: CurrentUserDep,
    service: DashboardServiceDep,
    year: int = Query(default=None),
) -> DashboardRevenue:
    if year is None:
        year = date.today().year
    return await service.get_revenue(clerk_user_id, year)
