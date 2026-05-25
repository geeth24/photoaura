from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from sqlalchemy.orm import Session
from config import settings
from db.base import get_session
from db.models import Video, VideoRevision
from services.aws_service import s3_client
from datetime import datetime, timedelta
from dependencies import get_current_user, require_admin

router = APIRouter()
AWS_BUCKET = settings.AWS_BUCKET
AWS_CLOUDFRONT_URL = settings.AWS_CLOUDFRONT_URL


@router.post("/api/videos/upload")
async def upload_video(
    file: UploadFile = File(...),
    client_id: int = None,
    current_user=Depends(require_admin),
    session: Session = Depends(get_session),
):
    if not file.content_type.startswith("video/"):
        raise HTTPException(status_code=400, detail="File must be a video")

    try:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        s3_key = f"videos/{client_id}/{timestamp}_{file.filename}"

        content = await file.read()
        s3_client.put_object(
            Bucket=AWS_BUCKET,
            Key=s3_key,
            Body=content,
            ContentType=file.content_type,
        )

        video = Video(
            client_id=client_id,
            title=file.filename,
            s3_key=s3_key,
            content_type=file.content_type,
            size=len(content),
        )
        session.add(video)
        session.flush()

        session.add(VideoRevision(video_id=video.id, s3_key=s3_key, version=1))

        return {"message": "Video uploaded successfully", "video_id": video.id}
    except HTTPException:
        raise
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/api/videos/revisions/cleanup")
async def cleanup_old_revisions(
    current_user=Depends(get_current_user), session: Session = Depends(get_session)
):
    """Cleanup revisions older than 2 weeks"""
    try:
        two_weeks_ago = datetime.now() - timedelta(weeks=2)

        revisions = (
            session.query(VideoRevision)
            .filter(
                VideoRevision.upload_date < two_weeks_ago,
                VideoRevision.permanent_storage.is_(False),
            )
            .all()
        )

        for revision in revisions:
            s3_client.delete_object(Bucket=AWS_BUCKET, Key=revision.s3_key)

        count = len(revisions)
        for revision in revisions:
            session.delete(revision)

        return {"message": f"Cleaned up {count} old revisions"}
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/videos/{client_id}")
async def get_client_videos(
    client_id: int,
    current_user=Depends(get_current_user),
    session: Session = Depends(get_session),
):
    try:
        rows = (
            session.query(
                Video,
                VideoRevision.version,
                VideoRevision.upload_date.label("revision_date"),
                VideoRevision.permanent_storage,
            )
            .outerjoin(VideoRevision, Video.id == VideoRevision.video_id)
            .filter(Video.client_id == client_id)
            .order_by(Video.upload_date.desc(), VideoRevision.version.desc())
            .all()
        )

        video_dict = {}
        for video, version, revision_date, permanent_storage in rows:
            if video.id not in video_dict:
                video_dict[video.id] = {
                    "id": video.id,
                    "title": video.title,
                    "content_type": video.content_type,
                    "size": video.size,
                    "upload_date": video.upload_date,
                    "url": f"https://{AWS_CLOUDFRONT_URL}/{video.s3_key}",
                    "revisions": [],
                }

            if version:
                video_dict[video.id]["revisions"].append(
                    {
                        "version": version,
                        "upload_date": revision_date,
                        "permanent_storage": permanent_storage,
                        "url": f"https://{AWS_CLOUDFRONT_URL}/{video.s3_key}",
                    }
                )

        return list(video_dict.values())
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/api/videos/revisions/{revision_id}/permanent")
async def set_revision_permanent(
    revision_id: int,
    permanent: bool,
    current_user=Depends(get_current_user),
    session: Session = Depends(get_session),
):
    try:
        revision = session.get(VideoRevision, revision_id)
        if revision is None:
            raise HTTPException(status_code=404, detail="Revision not found")

        revision.permanent_storage = permanent
        return {"message": f"Revision permanent storage set to {permanent}"}
    except HTTPException:
        raise
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=str(e))
