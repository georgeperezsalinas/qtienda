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

    RESEND_API_KEY: str = ""
    EMAIL_FROM: str = "qtienda <ventas@qtienda.shop>"
    APP_URL: str = "https://qtienda.shop"

    VAPID_PRIVATE_KEY: str = ""
    VAPID_PUBLIC_KEY: str = ""
    VAPID_CLAIMS_EMAIL: str = "mailto:ventas@qtienda.shop"

    CULQI_SECRET_KEY: str = ""
    CULQI_PUBLIC_KEY: str = ""
    TRIAL_DAYS: int = 14

    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
