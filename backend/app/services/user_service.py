from uuid import UUID
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.models.models import User
async def get_user_by_id(db, uid: UUID):
    r = await db.execute(select(User).options(selectinload(User.role)).where(User.id == uid))
    return r.scalar_one_or_none()
