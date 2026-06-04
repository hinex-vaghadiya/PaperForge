from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Supabase
    supabase_url: str = ""
    supabase_key: str = ""
    supabase_jwt_secret: str = ""

    # Groq AI
    groq_api_key: str = ""

    # App
    app_name: str = "Hinex PaperForge API"
    debug: bool = False
    allowed_origins: str = "http://localhost:3000"

    class Config:
        env_file = ".env"
        case_sensitive = False


@lru_cache()
def get_settings() -> Settings:
    return Settings()
