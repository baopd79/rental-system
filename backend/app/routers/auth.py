from fastapi import APIRouter
from app.dependencies import CurrentUserDep

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/me")
async def me(clerk_user_id: CurrentUserDep) -> dict:
    return {"clerk_user_id": clerk_user_id}
