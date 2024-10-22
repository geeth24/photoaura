from fastapi import APIRouter, HTTPException, Depends
from services.danger_delete import delete_all_resources
from services.database import create_table
from fastapi.security import OAuth2PasswordBearer
from routers.auth.auth_router import verify_token

router = APIRouter()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

@router.delete("/api/danger/delete")
async def delete_files(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=401,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    verify_token(token, credentials_exception)
    delete_all_resources()
    create_table()
    return {"message": "All files in the bucket have been deleted."}
