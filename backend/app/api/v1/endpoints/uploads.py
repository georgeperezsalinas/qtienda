"""Image upload endpoint — local storage o Cloudflare R2."""
import asyncio
import io
import os
import tempfile
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from PIL import Image, ImageOps

from app.core.config import settings
from app.core.security import require_vendor, get_current_user

router = APIRouter()

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
MAX_SIZE_MB = 5
MAX_DIMENSION = 1600  # lado mas largo tras el resize; el cliente ya manda logos mas chicos (512)
JPEG_QUALITY = 85
UPLOADS_DIR = Path(settings.UPLOADS_DIR)
MAX_REVIEW_PHOTOS = 4


def _process_image(content: bytes) -> tuple[bytes, str, str]:
    """Valida que el archivo sea una imagen real (el Content-Type lo manda el
    navegador y se puede falsificar), reescala si excede MAX_DIMENSION, quita
    metadata EXIF (incluye GPS de fotos tomadas con el celular) y recomprime
    a JPEG. Devuelve (bytes, extension, content_type)."""
    try:
        probe = Image.open(io.BytesIO(content))
        probe.verify()  # valida integridad sin decodificar todo el pixel data
        img = Image.open(io.BytesIO(content))  # reabrir: verify() deja el objeto inutilizable
    except Exception:
        raise HTTPException(status_code=422, detail="El archivo no es una imagen válida")

    # GIF animado: no recomprimir a JPEG, se perderia la animacion. Solo pasa
    # por el chequeo de MAX_SIZE_MB ya existente.
    if img.format == "GIF":
        return content, "gif", "image/gif"

    # Respeta la orientacion EXIF antes de descartarla (fotos de celular en
    # vertical se ven giradas si no se hace esto primero)
    img = ImageOps.exif_transpose(img)
    if img.mode not in ("RGB", "L"):
        img = img.convert("RGB")

    if max(img.size) > MAX_DIMENSION:
        img.thumbnail((MAX_DIMENSION, MAX_DIMENSION), Image.LANCZOS)

    out = io.BytesIO()
    img.save(out, format="JPEG", quality=JPEG_QUALITY, optimize=True)  # sin exif=... -> se descarta solo
    return out.getvalue(), "jpg", "image/jpeg"


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

    content, ext, content_type = await asyncio.to_thread(_process_image, content)
    filename = f"{uuid.uuid4()}.{ext}"

    if settings.S3_ENDPOINT and settings.S3_ACCESS_KEY:
        url = await _upload_r2(content, filename, content_type)
    else:
        url = _save_local(content, filename)

    return {"url": url, "filename": filename}


@router.post("/review-photo")
async def upload_review_photo(
    file: UploadFile = File(...),
    _=Depends(get_current_user),
):
    """Foto adjunta a una reseña de comprador — cualquier usuario autenticado
    puede subir (no solo vendedores, a diferencia de /uploads/image), porque
    quien deja una reseña es el comprador."""
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=422, detail="Tipo de archivo no permitido. Use JPEG, PNG o WebP.")

    content = await file.read()
    if len(content) > MAX_SIZE_MB * 1024 * 1024:
        raise HTTPException(status_code=422, detail=f"Imagen muy grande. Máximo {MAX_SIZE_MB}MB.")

    content, ext, content_type = await asyncio.to_thread(_process_image, content)
    filename = f"{uuid.uuid4()}.{ext}"

    if settings.S3_ENDPOINT and settings.S3_ACCESS_KEY:
        url = await _upload_r2(content, filename, content_type, object_key=f"reviews/{filename}")
    else:
        url = _save_local(content, filename)

    return {"url": url, "filename": filename}


ALLOWED_DIGITAL_EXTENSIONS = {".pdf", ".epub", ".mobi", ".zip", ".docx", ".mp3", ".mp4"}
PRIVATE_UPLOADS_DIR = Path(settings.PRIVATE_UPLOADS_DIR)


@router.post("/digital-file")
async def upload_digital_file(
    file: UploadFile = File(...),
    _=Depends(require_vendor),
):
    """Archivo digital de un producto (ebook, etc.) — a diferencia de /image,
    devuelve una `key` privada, nunca una URL pública: el archivo solo se
    sirve a través del endpoint de descarga del pedido, que valida que esté
    confirmado (ver public.py download_digital_file)."""
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_DIGITAL_EXTENSIONS:
        allowed = ", ".join(sorted(ALLOWED_DIGITAL_EXTENSIONS))
        raise HTTPException(status_code=422, detail=f"Tipo de archivo no permitido. Use: {allowed}")

    content = await file.read()
    max_bytes = settings.MAX_DIGITAL_SIZE_MB * 1024 * 1024
    if len(content) > max_bytes:
        raise HTTPException(status_code=422, detail=f"Archivo muy grande. Máximo {settings.MAX_DIGITAL_SIZE_MB}MB.")

    key = f"digital/{uuid.uuid4()}{ext}"

    if settings.S3_ENDPOINT and settings.S3_ACCESS_KEY:
        content_type = file.content_type or "application/octet-stream"
        await _upload_r2(content, Path(key).name, content_type, object_key=key)
    else:
        dest = PRIVATE_UPLOADS_DIR / key
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(content)

    return {"key": key, "filename": file.filename, "size": len(content)}


def presigned_download_url(key: str, expires_in: int = 300) -> str:
    """URL de GET prefirmada para un objeto privado de R2 (archivo digital).
    Corta duración a propósito: se regenera en cada click al link de
    descarga, el control de acceso real vive en el estado del pedido, no acá."""
    import boto3
    from botocore.config import Config

    s3 = boto3.client(
        "s3",
        endpoint_url=settings.S3_ENDPOINT,
        aws_access_key_id=settings.S3_ACCESS_KEY,
        aws_secret_access_key=settings.S3_SECRET_KEY,
        region_name="auto",
        config=Config(signature_version="s3v4", s3={"addressing_style": "path"}),
    )
    return s3.generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.S3_BUCKET, "Key": key},
        ExpiresIn=expires_in,
    )


async def download_object_bytes(key: str) -> bytes:
    """Baja el contenido de un objeto privado de R2 — usado cuando hay que
    procesar el archivo en el backend (ej. sellar un PDF) en vez de solo
    redirigir a una URL prefirmada.

    Igual que _upload_r2: boto3/urllib3 pegándole directo a R2 falla acá con
    handshake_failure (ClientHello de OpenSSL 3.5+ con ML-KEM, que Cloudflare
    rechaza), así que la URL prefirmada se genera local con boto3 (sin red)
    y el GET real lo hace curl con los mismos flags TLS que ya funcionan
    para el PUT de subida."""
    import certifi

    presigned_url = presigned_download_url(key)
    _openssl_cnf = "/app/openssl-compat.cnf"
    _env = {**os.environ, "OPENSSL_CONF": _openssl_cnf}

    with tempfile.NamedTemporaryFile() as tmp:
        proc = await asyncio.create_subprocess_exec(
            "curl", "--http1.1", "--tlsv1.2",
            "--curves", "X25519:P-256:P-384",
            "-s", "-S",
            "--cacert", certifi.where(),
            "-o", tmp.name,
            "-w", "%{http_code}",
            presigned_url,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            env=_env,
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=30)
        http_code = stdout.decode().strip()
        if http_code != "200":
            raise Exception(f"HTTP {http_code} al descargar {key}: {stderr.decode()[:300]}")
        tmp.seek(0)
        return tmp.read()


def is_own_upload_url(url: str) -> bool:
    """Confirma que una URL de foto realmente viene de nuestro storage (local,
    R2/CDN) y no es un link arbitrario que el cliente intenta colar — se usa
    para validar photo_urls antes de guardarlos en una reseña."""
    if not url:
        return False
    bases = [settings.UPLOADS_BASE_URL, settings.CDN_URL, f"{settings.S3_ENDPOINT}/{settings.S3_BUCKET}" if settings.S3_ENDPOINT else ""]
    return any(base and url.startswith(base) for base in bases)


def _save_local(content: bytes, filename: str) -> str:
    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    (UPLOADS_DIR / filename).write_bytes(content)
    return f"{settings.UPLOADS_BASE_URL}/{filename}"


async def _upload_r2(content: bytes, filename: str, content_type: str, object_key: str | None = None) -> str:
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

        key = object_key or f"products/{filename}"
        cache_control = "public, max-age=31536000, immutable"

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
            Params={
                "Bucket": settings.S3_BUCKET, "Key": key, "ContentType": content_type,
                "CacheControl": cache_control,
            },
            ExpiresIn=300,
        )

        # OPENSSL_CONF per-proceso excluye X25519MLKEM768 (OpenSSL 3.5+)
        # que Cloudflare R2 rechaza con handshake_failure.
        #_openssl_cnf = str(Path(__file__).resolve().parents[4] / "openssl-compat.cnf")
        _openssl_cnf = "/app/openssl-compat.cnf"
        _env = {**os.environ, "OPENSSL_CONF": _openssl_cnf}

        proc = await asyncio.create_subprocess_exec(
            #"curl", "-s", "-S", "-X", "PUT",
            "curl", "--http1.1", "--tlsv1.2",
            "--curves", "X25519:P-256:P-384",
            "-s", "-S", "-X", "PUT",
            "--cacert", certifi.where(),
            "-H", f"Content-Type: {content_type}",
            "-H", f"Cache-Control: {cache_control}",
            "--data-binary", "@-",
            "-o", "/dev/null",
            "-w", "%{http_code}",
            presigned_url,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            env=_env,
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(content), timeout=30)
        http_code = int(stdout.decode().strip())

        if http_code not in (200, 201, 204):
            raise Exception(f"HTTP {http_code}: {stderr.decode()[:300]}")

        base = settings.CDN_URL or f"{settings.S3_ENDPOINT}/{settings.S3_BUCKET}"
        return f"{base}/{key}"

    #except Exception as exc:
    #    raise HTTPException(status_code=500, detail=f"Error al subir imagen: {exc}")
    
    except Exception as exc:
       return _save_local(content, filename)
