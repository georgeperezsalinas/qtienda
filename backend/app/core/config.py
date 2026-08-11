from functools import lru_cache
from typing import List
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_NAME: str = "qtienda.shop"
    DEBUG: bool = False
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # psycopg3 async: postgresql+psycopg://user:pass@host:5432/db
    DATABASE_URL: str

    CORS_ORIGINS: List[str] = [
        "https://qtienda.shop",
        "http://localhost:3000",
    ]

    S3_ENDPOINT: str = ""
    S3_ACCESS_KEY: str = ""
    S3_SECRET_KEY: str = ""
    S3_BUCKET: str = "qtienda"
    CDN_URL: str = ""
    WA_BASE_URL: str = "https://wa.me/"
    FREE_PLAN_SLUG: str = "free"

    # Referidos: bonus de limites para plan free por cada referido con tienda creada
    REFERRAL_BONUS_PRODUCTS: int = 5
    REFERRAL_BONUS_ORDERS: int = 50
    REFERRAL_MAX_REFERRALS: int = 10

    RESEND_API_KEY: str = ""
    EMAIL_FROM: str = "qtienda <ventas@qtienda.shop>"
    APP_URL: str = "https://qtienda.shop"

    VAPID_PRIVATE_KEY: str = ""
    VAPID_PUBLIC_KEY: str = ""
    VAPID_CLAIMS_EMAIL: str = "mailto:ventas@qtienda.shop"

    CULQI_SECRET_KEY: str = ""
    CULQI_PUBLIC_KEY: str = ""
    TRIAL_DAYS: int = 14

    # Yape directo (pago manual de planes, aprobado por admin)
    YAPE_PAYMENT_PHONE: str = "921459342"
    YAPE_PAYMENT_NAME: str = "Jorge P. Salinas"

    # Aviso de vencimiento de plan
    PLAN_EXPIRY_NOTICE_DAYS: int = 3   # avisar cuando falten <= N dias
    PLAN_EXPIRY_CHECK_HOURS: int = 6   # frecuencia del chequeo
    PLAN_EXPIRY_GRACE_DAYS: int = 4    # dias de gracia tras vencer antes de bajar al plan gratuito

    # Salud de tienda: reactivacion e impulso de ventas
    STORE_INACTIVE_DAYS: int = 7        # sin pedidos ni visitas en N dias -> "reactiva tu tienda"
    STORE_NO_SALES_DAYS: int = 30       # sin pedidos en N dias (con productos) -> "consejos para vender"
    STORE_HEALTH_CHECK_HOURS: int = 6   # frecuencia del chequeo

    # Avisos escalonados de tienda sin productos — solo advertencias, nunca
    # suspenden la tienda automaticamente (decision manual del equipo/admin)
    STORE_NO_PRODUCTS_WARN_DAYS: int = 7
    STORE_NO_PRODUCTS_FINAL_DAYS: int = 14
    STORE_NO_PRODUCTS_URGENT_DAYS: int = 30

    # Avisos escalonados de tienda sin logo/banner — solo un empujon, la
    # tienda sí puede vender sin esto (no arriesga nada, a diferencia de sin
    # productos)
    STORE_MISSING_BRANDING_WARN_DAYS: int = 7
    STORE_MISSING_BRANDING_FINAL_DAYS: int = 14
    STORE_MISSING_BRANDING_URGENT_DAYS: int = 30

    # Insignia "Tienda verificada" — 100% automatica en base a datos reales,
    # nunca vetting manual (no escala con miles de tiendas). Umbral de
    # cancelacion solo aplica si hay muestra minima (evita castigar tiendas
    # nuevas con 1 pedido cancelado de 1).
    STORE_VERIFIED_MIN_AGE_DAYS: int = 30
    STORE_VERIFIED_MIN_DELIVERED: int = 15
    STORE_VERIFIED_MAX_CANCEL_RATE: float = 0.2
    STORE_VERIFIED_MIN_SAMPLE: int = 10   # pedidos entregados+cancelados minimos para evaluar tasa

    UPLOADS_DIR: str = "/tmp/qtienda-uploads"
    UPLOADS_BASE_URL: str = "http://localhost:8000/uploads"

    # Facebook Login — https://developers.facebook.com/apps
    # Opcional: si se configura, se agrega appsecret_proof a las llamadas a Graph API
    FACEBOOK_APP_SECRET: str = ""

    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
