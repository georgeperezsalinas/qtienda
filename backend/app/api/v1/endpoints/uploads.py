"""Image upload endpoint — local storage or S3/R2."""
import os
import ssl
import uuid
from pathlib import Path

import urllib3.util.ssl_ as _u3ssl
import botocore.httpsession as _bh

# Forzar SECLEVEL=1 en botocore/urllib3 (necesario para Cloudflare R2 en Docker)
_orig_u3_ctx = _u3ssl.create_urllib3_context

def _seclevel1(*a, **kw):
    ctx = _orig_u3_ctx(*a, **kw)
    try:
        ctx.set_ciphers("DEFAULT:@SECLEVEL=1")
    except ssl.SSLError:
        pass
    return ctx

_u3ssl.create_urllib3_context = _seclevel1
_bh.create_urllib3_context = _seclevel1

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import JSONResponse

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
        import certifi
        import boto3
        from botocore.config import Config

        s3 = boto3.client(
            "s3",
            endpoint_url=settings.S3_ENDPOINT,
            aws_access_key_id=settings.S3_ACCESS_KEY,
            aws_secret_access_key=settings.S3_SECRET_KEY,
            config=Config(signature_version="s3v4"),
            verify=certifi.where(),
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
