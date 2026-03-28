import os
from typing import Optional

class Settings:
    POSTGRES_HOST: str = os.environ.get("POSTGRES_HOST", "localhost")
    POSTGRES_DB: str = os.environ.get("POSTGRES_DB", "aura")
    POSTGRES_USER: str = os.environ.get("POSTGRES_USER", "aura")
    POSTGRES_PASSWORD: str = os.environ.get("POSTGRES_PASSWORD", "aura")
    
    ROOT_USER: str = os.environ.get("ROOT_USER", "root")
    ROOT_PASSWORD: str = os.environ.get("ROOT_PASSWORD", "password")
    ROOT_EMAIL: str = os.environ.get("ROOT_EMAIL", "xxxx@xxxxxxxxx")
    ROOT_FULL_NAME: str = os.environ.get("ROOT_FULL_NAME", "root")
    
    SECRET_KEY: str = os.environ.get("SECRET_KEY", "your_secret_key_here")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    
    AWS_ACCESS_KEY: Optional[str] = os.environ.get("AWS_ACCESS_KEY")
    AWS_SECRET_KEY: Optional[str] = os.environ.get("AWS_SECRET_KEY")
    AWS_REGION: Optional[str] = os.environ.get("AWS_REGION")
    AWS_BUCKET: Optional[str] = os.environ.get("AWS_BUCKET")
    AWS_CLOUDFRONT_URL: Optional[str] = os.environ.get("AWS_CLOUDFRONT_URL")
    
    DATA_DIR: str = "/var/aura/data"
    
    CORS_ORIGINS: list[str] = os.environ.get("CORS_ORIGINS", "*").split(",")

settings = Settings()

