from fastapi import APIRouter, HTTPException
from services.danger_delete import delete_all_resources
from services.database import create_table

router = APIRouter()


@router.delete("/api/danger/delete")
async def delete_files():
    delete_all_resources()
    create_table()
    return {"message": "All files in the bucket have been deleted."}
