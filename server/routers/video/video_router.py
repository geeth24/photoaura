from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from fastapi.security import OAuth2PasswordBearer
from services.database import get_db
from services.aws_service import s3_client
from datetime import datetime, timedelta
import os

router = APIRouter()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")
AWS_BUCKET = os.environ.get("AWS_BUCKET")
AWS_CLOUDFRONT_URL = os.environ.get("AWS_CLOUDFRONT_URL")

@router.post("/api/videos/upload")
async def upload_video(
    file: UploadFile = File(...),
    client_id: int = None,
    token: str = Depends(oauth2_scheme)
):
    if not file.content_type.startswith('video/'):
        raise HTTPException(status_code=400, detail="File must be a video")
        
    db, cursor = get_db()
    try:
        # Generate unique S3 key
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        s3_key = f"videos/{client_id}/{timestamp}_{file.filename}"
        
        # Upload to S3
        content = await file.read()
        s3_client.put_object(
            Bucket=AWS_BUCKET,
            Key=s3_key,
            Body=content,
            ContentType=file.content_type
        )
        
        # Store in database
        cursor.execute("""
            INSERT INTO videos 
            (client_id, title, s3_key, content_type, size)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING id
        """, (
            client_id,
            file.filename,
            s3_key,
            file.content_type,
            len(content)
        ))
        video_id = cursor.fetchone()[0]
        
        # Create initial revision
        cursor.execute("""
            INSERT INTO video_revisions 
            (video_id, s3_key, version)
            VALUES (%s, %s, %s)
        """, (video_id, s3_key, 1))
        
        db.commit()
        return {"message": "Video uploaded successfully", "video_id": video_id}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/api/videos/revisions/cleanup")
async def cleanup_old_revisions(token: str = Depends(oauth2_scheme)):
    """Cleanup revisions older than 2 weeks"""
    db, cursor = get_db()
    try:
        two_weeks_ago = datetime.now() - timedelta(weeks=2)
        
        # Get revisions to delete
        cursor.execute("""
            SELECT s3_key FROM video_revisions 
            WHERE upload_date < %s 
            AND permanent_storage = FALSE
        """, (two_weeks_ago,))
        
        revisions = cursor.fetchall()
        
        # Delete from S3
        for revision in revisions:
            s3_client.delete_object(
                Bucket=AWS_BUCKET,
                Key=revision[0]
            )
        
        # Delete from database
        cursor.execute("""
            DELETE FROM video_revisions 
            WHERE upload_date < %s 
            AND permanent_storage = FALSE
        """, (two_weeks_ago,))
        
        db.commit()
        return {"message": f"Cleaned up {len(revisions)} old revisions"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/api/videos/{client_id}")
async def get_client_videos(
    client_id: int,
    token: str = Depends(oauth2_scheme)
):
    db, cursor = get_db()
    try:
        cursor.execute("""
            SELECT v.*, vr.version, vr.upload_date as revision_date, vr.permanent_storage
            FROM videos v
            LEFT JOIN video_revisions vr ON v.id = vr.video_id
            WHERE v.client_id = %s
            ORDER BY v.upload_date DESC, vr.version DESC
        """, (client_id,))
        
        videos = cursor.fetchall()
        
        # Group videos by their main entry, with revisions as sub-entries
        video_dict = {}
        for video in videos:
            if video[0] not in video_dict:
                video_dict[video[0]] = {
                    "id": video[0],
                    "title": video[2],
                    "content_type": video[4],
                    "size": video[5],
                    "upload_date": video[6],
                    "url": f"https://{AWS_CLOUDFRONT_URL}/{video[3]}",
                    "revisions": []
                }
            
            if video[7]:  # If there's revision data
                video_dict[video[0]]["revisions"].append({
                    "version": video[7],
                    "upload_date": video[8],
                    "permanent_storage": video[9],
                    "url": f"https://{AWS_CLOUDFRONT_URL}/{video[3]}"
                })
        
        return list(video_dict.values())
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/api/videos/revisions/{revision_id}/permanent")
async def set_revision_permanent(
    revision_id: int,
    permanent: bool,
    token: str = Depends(oauth2_scheme)
):
    db, cursor = get_db()
    try:
        cursor.execute("""
            UPDATE video_revisions
            SET permanent_storage = %s
            WHERE id = %s
            RETURNING video_id
        """, (permanent, revision_id))
        
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Revision not found")
            
        db.commit()
        return {"message": f"Revision permanent storage set to {permanent}"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e)) 