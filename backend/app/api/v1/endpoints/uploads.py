"""Image upload endpoint — local storage o Cloudflare R2."""
import asyncio
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
    Sube a Cloudflare R2.
    - boto3 genera la URL presignada localmente (sin red).
    - curl hace el PUT con --curves para excluir ML-KEM de OpenSSL 3.5,
      cuyo ClientHello de ~1600 bytes Cloudflare R2 rechaza con handshake_failure.
    """
    try:
        import certifi
        import boto3
        from botocore.config import Config

        key = f"products/{filename}"

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

        proc = await asyncio.create_subprocess_exec(
            "curl", "-s", "-S", "-X", "PUT",
            "--curves", "X25519:P-256:P-384:P-521",
            "--cacert", certifi.where(),
            "-H", f"Content-Type: {content_type}",
            "--data-binary", "@-",
            "-o", "/dev/null",
            "-w", "%{http_code}",
            presigned_url,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(content), timeout=30)
        http_code = int(stdout.decode().strip())

        if http_code not in (200, 201, 204):
            raise Exception(f"HTTP {http_code}: {stderr.decode()[:300]}")

        base = settings.CDN_URL or f"{settings.S3_ENDPOINT}/{settings.S3_BUCKET}"
        return f"{base}/{key}"

    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Error al subir imagen: {exc}")
