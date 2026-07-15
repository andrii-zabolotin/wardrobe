from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # DB
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/wardrobe"
    # Redis
    redis_url: str = "redis://localhost:6379/0"
    # Qdrant
    qdrant_url: str = "http://localhost:6333"
    qdrant_collection: str = "garments"
    # Gemini
    gemini_api_key: str = ""
    # Auth
    jwt_secret: str = "change_me_in_production"
    jwt_expire_minutes: int = 10080  # 7 days
    # Files
    media_root: str = "/app/media"
    max_upload_size_mb: int = 20
    
    # Dev Mode
    dev_mode: bool = False

    # AI Models
    model_detection: str = "gemini-3-flash-preview"
    model_composer: str = "gemini-3-flash-preview"
    model_image_gen: str = "gemini-3.1-flash-image"
    model_stylist: str = "gemini-3-flash-preview"
    model_embeddings: str = "gemini-embedding-2"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

settings = Settings()
