"""Image upload endpoint — local storage or S3/R2."""
import os
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.security import require_vendor

router = APIRouter()

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
MAX_SIZE_MB = 5
UPLOADS_DIR = Path(os.getenv("UPLOADS_DIR", "/app/data/uploads"))


@router.post("/image")
async def upload_image(
    file: UploadFile = File(...),
    _=Depends(require_vendor),
):
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=422, detail="Tipo de archivo no permitido. Use JPEG, PNG o WebP.")

    content = await file.read()
    size_mb = len(content) / (1024 * 1024)
    if size_mb > MAX_SIZE_MB:
        raise HTTPException(status_code=422, detail=f"Imagen muy grande. Máximo {MAX_SIZE_MB}MB.")

    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in (file.filename or "") else "jpg"
    filename = f"{uuid.uuid4()}.{ext}"

    # Use S3/R2 if configured, otherwise save locally
    if settings.S3_ENDPOINT and settings.S3_ACCESS_KEY:
        url = await _upload_s3(content, filename, file.content_type)
    else:
        url = _save_local(content, filename)

    return {"url": url, "filename": filename}


def _save_local(content: bytes, filename: str) -> str:
    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    dest = UPLOADS_DIR / filename
    dest.write_bytes(content)
    base = os.getenv("UPLOADS_BASE_URL", "http://localhost:8000/uploads")
    return f"{base}/{filename}"


async def _upload_s3(content: bytes, filename: str, content_type: str) -> str:
    try:
        import boto3
        from botocore.config import Config

        s3 = boto3.client(
            "s3",
            endpoint_url=settings.S3_ENDPOINT,
            aws_access_key_id=settings.S3_ACCESS_KEY,
            aws_secret_access_key=settings.S3_SECRET_KEY,
            config=Config(signature_version="s3v4"),
        )
        key = f"products/{filename}"
        s3.put_object(
            Bucket=settings.S3_BUCKET,
            Key=key,
            Body=content,
            ContentType=content_type,
            ACL="public-read",
        )
        base = settings.CDN_URL or f"{settings.S3_ENDPOINT}/{settings.S3_BUCKET}"
        return f"{base}/{key}"
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Error al subir imagen: {exc}")
