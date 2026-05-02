"""
Crea (o actualiza) un usuario con rol admin.
Uso:  cd backend && python create_admin.py
      cd backend && python create_admin.py --email tu@mail.com --password MiPass123!
"""
import asyncio
import argparse
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

from app.core.config import settings
from app.models.models import Role, User

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


async def run(email: str, password: str, full_name: str):
    engine = create_async_engine(settings.DATABASE_URL)
    Session = async_sessionmaker(engine, expire_on_commit=False)

    async with Session() as db:
        role = (await db.execute(select(Role).where(Role.name == "admin"))).scalar_one_or_none()
        if not role:
            print("ERROR: rol 'admin' no existe. Aplica las migraciones primero.")
            await engine.dispose()
            sys.exit(1)

        existing = (await db.execute(select(User).where(User.email == email))).scalar_one_or_none()
        if existing:
            existing.role_id = role.id
            existing.is_active = True
            existing.is_verified = True
            await db.commit()
            print(f"Usuario {email} actualizado a admin.")
            await engine.dispose()
            return

        user = User(
            email=email,
            full_name=full_name,
            password_hash=pwd_context.hash(password),
            role_id=role.id,
            is_active=True,
            is_verified=True,
        )
        db.add(user)
        await db.commit()
        print(f"Admin creado: {email} / {password}")

    await engine.dispose()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--email",    default="admin@qtienda.shop")
    parser.add_argument("--password", default="Admin1234!")
    parser.add_argument("--name",     default="Administrador")
    args = parser.parse_args()
    asyncio.run(run(args.email, args.password, args.name))
