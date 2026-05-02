import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
import httpx
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.models.models import User, Role
from app.core.security import (
    hash_password, verify_password,
    create_access_token, create_refresh_token, decode_token,
    get_current_user,
)
from app.schemas.auth import (
    RegisterRequest, LoginRequest, TokenResponse, RefreshRequest
)

router = APIRouter()


@router.post("/register", response_model=TokenResponse, status_code=201)
async def register(payload: RegisterRequest, db: AsyncSession = Depends(get_db)):
    # Check duplicate email
    existing = await db.execute(select(User).where(User.email == payload.email.lower()))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email ya registrado")

    role = await db.execute(select(Role).where(Role.name == "vendor"))
    vendor_role = role.scalar_one_or_none()
    if not vendor_role:
        raise HTTPException(status_code=500, detail="Error de configuración del sistema")

    user = User(
        role_id=vendor_role.id,
        email=payload.email.lower().strip(),
        full_name=payload.full_name.strip(),
        phone=payload.phone,
        password_hash=hash_password(payload.password),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    return TokenResponse(
        access_token=create_access_token(user.id, "vendor"),
        refresh_token=create_refresh_token(user.id),
        token_type="bearer",
    )


@router.post("/register-buyer", response_model=TokenResponse, status_code=201)
async def register_buyer(payload: RegisterRequest, db: AsyncSession = Depends(get_db)):
    # Si ya tiene cuenta con ese email → simplemente iniciar sesión
    # (un vendedor puede comprar con su misma cuenta)
    existing_q = await db.execute(
        select(User).options(selectinload(User.role))
        .where(User.email == payload.email.lower(), User.deleted_at.is_(None))
    )
    existing_user = existing_q.scalar_one_or_none()
    if existing_user:
        if not existing_user.is_active:
            raise HTTPException(status_code=403, detail="Cuenta suspendida. Contacta soporte.")
        if not verify_password(payload.password, existing_user.password_hash):
            raise HTTPException(status_code=401, detail="Contraseña incorrecta para esa cuenta")
        existing_user.last_login_at = datetime.now(timezone.utc)
        await db.commit()
        return TokenResponse(
            access_token=create_access_token(existing_user.id, existing_user.role.name),
            refresh_token=create_refresh_token(existing_user.id),
            token_type="bearer",
        )

    role = await db.execute(select(Role).where(Role.name == "buyer"))
    buyer_role = role.scalar_one_or_none()
    if not buyer_role:
        raise HTTPException(status_code=500, detail="Error de configuración del sistema")

    user = User(
        role_id=buyer_role.id,
        email=payload.email.lower().strip(),
        full_name=payload.full_name.strip(),
        phone=payload.phone,
        password_hash=hash_password(payload.password),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    return TokenResponse(
        access_token=create_access_token(user.id, "buyer"),
        refresh_token=create_refresh_token(user.id),
        token_type="bearer",
    )


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(User)
        .options(selectinload(User.role))
        .where(
            User.email == payload.email.lower(),
            User.deleted_at.is_(None),
        )
    )
    user = result.scalar_one_or_none()

    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Credenciales inválidas")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Cuenta suspendida")

    user.last_login_at = datetime.now(timezone.utc)
    await db.commit()

    return TokenResponse(
        access_token=create_access_token(user.id, user.role.name),
        refresh_token=create_refresh_token(user.id),
        token_type="bearer",
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh(payload: RefreshRequest, db: AsyncSession = Depends(get_db)):
    decoded = decode_token(payload.refresh_token)
    if decoded.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Token inválido")

    from uuid import UUID
    from app.services.user_service import get_user_by_id
    user = await get_user_by_id(db, UUID(decoded["sub"]))
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Usuario inválido")

    return TokenResponse(
        access_token=create_access_token(user.id, user.role.name),
        refresh_token=create_refresh_token(user.id),
        token_type="bearer",
    )


@router.post("/google", response_model=TokenResponse)
async def google_login(payload: dict, db: AsyncSession = Depends(get_db)):
    access_token = (payload.get("access_token") or "").strip()
    if not access_token:
        raise HTTPException(status_code=422, detail="Token requerido")

    # Verify token and get user info from Google
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(
            "https://www.googleapis.com/oauth2/v1/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
        )
    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="Token de Google inválido")

    info = r.json()
    email = (info.get("email") or "").lower().strip()
    if not email or not info.get("verified_email", False):
        raise HTTPException(status_code=401, detail="Email de Google no verificado")

    # Find or create user
    result = await db.execute(
        select(User).options(selectinload(User.role)).where(
            User.email == email, User.deleted_at.is_(None)
        )
    )
    user = result.scalar_one_or_none()

    if not user:
        role_result = await db.execute(select(Role).where(Role.name == "vendor"))
        vendor_role = role_result.scalar_one_or_none()
        if not vendor_role:
            raise HTTPException(status_code=500, detail="Error de configuración")

        user = User(
            role_id=vendor_role.id,
            email=email,
            full_name=info.get("name") or email.split("@")[0],
            password_hash=hash_password(str(uuid.uuid4())),
            avatar_url=info.get("picture"),
            is_active=True,
            is_verified=True,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
        # Reload with role
        result2 = await db.execute(
            select(User).options(selectinload(User.role)).where(User.id == user.id)
        )
        user = result2.scalar_one()

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Cuenta suspendida. Contacta soporte.")

    user.last_login_at = datetime.now(timezone.utc)
    await db.commit()

    return TokenResponse(
        access_token=create_access_token(user.id, user.role.name),
        refresh_token=create_refresh_token(user.id),
    )


@router.post("/google-buyer", response_model=TokenResponse)
async def google_buyer(payload: dict, db: AsyncSession = Depends(get_db)):
    access_token = (payload.get("access_token") or "").strip()
    if not access_token:
        raise HTTPException(status_code=422, detail="Token requerido")

    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(
            "https://www.googleapis.com/oauth2/v1/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
        )
    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="Token de Google inválido")

    info = r.json()
    email = (info.get("email") or "").lower().strip()
    if not email or not info.get("verified_email", False):
        raise HTTPException(status_code=401, detail="Email de Google no verificado")

    result = await db.execute(
        select(User).options(selectinload(User.role)).where(
            User.email == email, User.deleted_at.is_(None)
        )
    )
    user = result.scalar_one_or_none()

    if not user:
        role_result = await db.execute(select(Role).where(Role.name == "buyer"))
        buyer_role = role_result.scalar_one_or_none()
        if not buyer_role:
            raise HTTPException(status_code=500, detail="Error de configuración")

        user = User(
            role_id=buyer_role.id,
            email=email,
            full_name=info.get("name") or email.split("@")[0],
            password_hash=hash_password(str(uuid.uuid4())),
            avatar_url=info.get("picture"),
            is_active=True,
            is_verified=True,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
        result2 = await db.execute(
            select(User).options(selectinload(User.role)).where(User.id == user.id)
        )
        user = result2.scalar_one()

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Cuenta suspendida. Contacta soporte.")

    user.last_login_at = datetime.now(timezone.utc)
    await db.commit()

    return TokenResponse(
        access_token=create_access_token(user.id, user.role.name),
        refresh_token=create_refresh_token(user.id),
    )


@router.get("/me")
async def me(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "role": current_user.role.name,
        "avatar_url": current_user.avatar_url,
    }
