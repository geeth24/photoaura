import os
from typing import Optional

MIN_SECRET_KEY_LENGTH = 32
_OLD_DEFAULT_SECRET = "your_secret_key_here"


def _load_secret_key() -> str:
    value = os.environ.get("SECRET_KEY", "").strip()
    how_to = (
        'Generate one with: python3 -c "import secrets; print(secrets.token_urlsafe(48))" '
        "and set it as SECRET_KEY in the environment."
    )
    if not value:
        raise RuntimeError(f"SECRET_KEY is not set. Refusing to start. {how_to}")
    if value == _OLD_DEFAULT_SECRET:
        raise RuntimeError(
            f"SECRET_KEY is the placeholder from the public repo. Refusing to start. {how_to}"
        )
    if len(value) < MIN_SECRET_KEY_LENGTH:
        raise RuntimeError(
            f"SECRET_KEY is too short ({len(value)} characters, need at least "
            f"{MIN_SECRET_KEY_LENGTH}). Refusing to start. {how_to}"
        )
    return value


class Settings:
    POSTGRES_HOST: str = os.environ.get("POSTGRES_HOST", "localhost")
    POSTGRES_PORT: str = os.environ.get("POSTGRES_PORT", "5432")
    POSTGRES_DB: str = os.environ.get("POSTGRES_DB", "aura")
    POSTGRES_USER: str = os.environ.get("POSTGRES_USER", "aura")
    POSTGRES_PASSWORD: str = os.environ.get("POSTGRES_PASSWORD", "aura")

    @property
    def DATABASE_URL(self) -> str:
        return (
            f"postgresql+psycopg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )
    
    ROOT_USER: str = os.environ.get("ROOT_USER", "root")
    ROOT_PASSWORD: str = os.environ.get("ROOT_PASSWORD", "password")
    ROOT_EMAIL: str = os.environ.get("ROOT_EMAIL", "xxxx@xxxxxxxxx")
    ROOT_FULL_NAME: str = os.environ.get("ROOT_FULL_NAME", "root")
    
    SECRET_KEY: str = _load_secret_key()
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    
    AWS_ACCESS_KEY: Optional[str] = os.environ.get("AWS_ACCESS_KEY")
    AWS_SECRET_KEY: Optional[str] = os.environ.get("AWS_SECRET_KEY")
    AWS_REGION: Optional[str] = os.environ.get("AWS_REGION")
    AWS_BUCKET: Optional[str] = os.environ.get("AWS_BUCKET")
    AWS_CLOUDFRONT_URL: Optional[str] = os.environ.get("AWS_CLOUDFRONT_URL")
    AWS_CLOUDFRONT_DISTRIBUTION_ID: Optional[str] = os.environ.get(
        "AWS_CLOUDFRONT_DISTRIBUTION_ID"
    )
    
    DATA_DIR: str = os.environ.get("DATA_DIR", "/var/aura/data")
    
    CORS_ORIGINS: list[str] = os.environ.get("CORS_ORIGINS", "*").split(",")

settings = Settings()

