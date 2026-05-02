"""Image upload endpoint — local storage o Cloudflare R2."""
import os
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from app.core.config import settings
from app.core.security import require_vendor

router = APIRouter()

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
MAX_SIZE_MB = 5
UPLOADS_DIR = Path(os.getenv("UPLOADS_DIR", "/tmp/qtienda-uploads"))


@router.post("/image")
async def upload_image(
    file: UploadFile = File(...),
    _=Depends(require_vendor),
):
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=422, detail="Tipo de archivo no permitido. Use JPEG, PNG o WebP.")

    content = await file.read()
    if len(content) > MAX_SIZE_MB * 1024 * 1024:
        raise HTTPException(status_code=422, detail=f"Imagen muy grande. Máximo {MAX_SIZE_MB}MB.")

    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in (file.filename or "") else "jpg"
    filename = f"{uuid.uuid4()}.{ext}"

    if settings.S3_ENDPOINT and settings.S3_ACCESS_KEY:
        url = await _upload_r2(content, filename, file.content_type)
    else:
        url = _save_local(content, filename)

    return {"url": url, "filename": filename}


def _save_local(content: bytes, filename: str) -> str:
    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    (UPLOADS_DIR / filename).write_bytes(content)
    base = os.getenv("UPLOADS_BASE_URL", "http://localhost:8000/uploads")
    return f"{base}/{filename}"


async def _upload_r2(content: bytes, filename: str, content_type: str) -> str:
    """
    Sube a Cloudflare R2 usando:
      1. boto3 solo para firmar la URL presignada (sin llamada de red)
      2. httpx con ssl.SSLContext explícito para el PUT real
    Esto evita el stack SSL de botocore/urllib3 que falla en Debian Bookworm.
    """
    try:
        import certifi
        import httpx
        import boto3
        from botocore.config import Config

        key = f"products/{filename}"

        # Firmar URL localmente — cero llamadas de red aquí
        s3 = boto3.client(
            "s3",
            endpoint_url=settings.S3_ENDPOINT,
            aws_access_key_id=settings.S3_ACCESS_KEY,
            aws_secret_access_key=settings.S3_SECRET_KEY,
            region_name="auto",
            config=Config(
                signature_version="s3v4",
                s3={"addressing_style": "path"},
            ),
        )
        presigned_url = s3.generate_presigned_url(
            "put_object",
            Params={"Bucket": settings.S3_BUCKET, "Key": key, "ContentType": content_type},
            ExpiresIn=300,
        )

        async with httpx.AsyncClient(verify=certifi.where()) as client:
            resp = await client.put(
                presigned_url,
                content=content,
                headers={"Content-Type": content_type},
                timeout=30.0,
            )
            resp.raise_for_status()

        base = settings.CDN_URL or f"{settings.S3_ENDPOINT}/{settings.S3_BUCKET}"
        return f"{base}/{key}"

    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Error al subir imagen: {exc}")
