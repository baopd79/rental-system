from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/rental_db"
    CLERK_JWKS_URL: str = ""
    CLERK_AUDIENCE: str = ""
    CORS_ORIGINS: list[str] = ["http://localhost:3000"]


settings = Settings()
