from fastapi import APIRouter, Depends
from services.danger_delete import delete_all_resources
from db.migrate import run_migrations
from db.seed import seed_root_user
from dependencies import get_current_user

router = APIRouter()


@router.delete("/api/danger/delete")
async def delete_files(current_user=Depends(get_current_user)):
    delete_all_resources()
    run_migrations()
    seed_root_user()
    return {"message": "All files in the bucket have been deleted."}
