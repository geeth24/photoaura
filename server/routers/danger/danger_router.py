from fastapi import APIRouter, Depends
from services.danger_delete import delete_all_resources
from services.database import create_table
from dependencies import get_current_user

router = APIRouter()

@router.delete("/api/danger/delete")
async def delete_files(current_user = Depends(get_current_user)):
    delete_all_resources()
    create_table()
    return {"message": "All files in the bucket have been deleted."}
