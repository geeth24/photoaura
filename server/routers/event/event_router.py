from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from models.event import Event, EventType, EventResponse
from db.base import get_session
from db.models import (
    Event as EventModel,
    EventType as EventTypeModel,
    User as UserModel,
)
from dependencies import get_current_user

router = APIRouter()


@router.post("/api/event-types")
async def create_event_type(
    event_type: EventType,
    current_user=Depends(get_current_user),
    session: Session = Depends(get_session),
):
    try:
        new_type = EventTypeModel(name=event_type.name, priority=event_type.priority)
        session.add(new_type)
        session.flush()
        session.refresh(new_type)

        return {
            "id": new_type.id,
            "name": new_type.name,
            "priority": new_type.priority,
            "created_at": new_type.created_at,
        }
    except HTTPException:
        raise
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/event-types")
async def get_event_types(session: Session = Depends(get_session)):
    try:
        results = (
            session.query(EventTypeModel)
            .order_by(EventTypeModel.priority.desc(), EventTypeModel.name)
            .all()
        )
        return [
            {
                "id": result.id,
                "name": result.name,
                "priority": result.priority,
                "created_at": result.created_at,
            }
            for result in results
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/events")
async def create_event(
    event: Event,
    current_user=Depends(get_current_user),
    session: Session = Depends(get_session),
):
    try:
        user = (
            session.query(UserModel)
            .filter_by(user_name=current_user.user_name)
            .first()
        )
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        if session.get(EventTypeModel, event.event_type_id) is None:
            raise HTTPException(status_code=400, detail="Invalid event type")

        new_event = EventModel(
            name=event.name,
            event_type_id=event.event_type_id,
            event_date=event.event_date,
            location=event.location,
            description=event.description,
            created_by=user.id,
        )
        session.add(new_event)
        session.flush()

        return {"id": new_event.id, "message": "Event created successfully"}
    except HTTPException:
        raise
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=str(e))


def _event_json(event, event_type_name, creator_name):
    return {
        "id": event.id,
        "name": event.name,
        "event_type_id": event.event_type_id,
        "event_type": event_type_name,
        "event_date": event.event_date,
        "location": event.location,
        "description": event.description,
        "created_by": event.created_by,
        "created_by_name": creator_name,
        "created_at": event.created_at,
    }


@router.get("/api/events")
async def get_events(
    current_user=Depends(get_current_user), session: Session = Depends(get_session)
):
    try:
        rows = (
            session.query(
                EventModel,
                EventTypeModel.name.label("event_type_name"),
                UserModel.full_name.label("creator_name"),
            )
            .join(EventTypeModel, EventModel.event_type_id == EventTypeModel.id)
            .join(UserModel, EventModel.created_by == UserModel.id)
            .order_by(EventModel.event_date.desc())
            .all()
        )
        return [_event_json(e, et_name, creator) for e, et_name, creator in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/events/{event_id}")
async def get_event(
    event_id: int,
    current_user=Depends(get_current_user),
    session: Session = Depends(get_session),
):
    try:
        row = (
            session.query(
                EventModel,
                EventTypeModel.name.label("event_type_name"),
                UserModel.full_name.label("creator_name"),
            )
            .join(EventTypeModel, EventModel.event_type_id == EventTypeModel.id)
            .join(UserModel, EventModel.created_by == UserModel.id)
            .filter(EventModel.id == event_id)
            .first()
        )

        if not row:
            raise HTTPException(status_code=404, detail="Event not found")

        event, et_name, creator = row
        return _event_json(event, et_name, creator)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/api/events/{event_id}")
async def update_event(
    event_id: int,
    updated_event: Event,
    current_user=Depends(get_current_user),
    session: Session = Depends(get_session),
):
    try:
        event = session.get(EventModel, event_id)
        if event is None:
            raise HTTPException(status_code=404, detail="Event not found")

        if session.get(EventTypeModel, updated_event.event_type_id) is None:
            raise HTTPException(status_code=400, detail="Invalid event type")

        event.name = updated_event.name
        event.event_type_id = updated_event.event_type_id
        event.event_date = updated_event.event_date
        event.location = updated_event.location
        event.description = updated_event.description

        return {"message": "Event updated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/api/events/{event_id}")
async def delete_event(
    event_id: int,
    current_user=Depends(get_current_user),
    session: Session = Depends(get_session),
):
    try:
        event = session.get(EventModel, event_id)
        if event is None:
            raise HTTPException(status_code=404, detail="Event not found")

        session.delete(event)
        return {"message": "Event deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/api/event-types/{event_type_id}")
async def delete_event_type(
    event_type_id: int,
    current_user=Depends(get_current_user),
    session: Session = Depends(get_session),
):
    try:
        in_use = (
            session.query(EventModel.id)
            .filter_by(event_type_id=event_type_id)
            .first()
        )
        if in_use is not None:
            raise HTTPException(
                status_code=400,
                detail="Cannot delete event type that is being used by events",
            )

        event_type = session.get(EventTypeModel, event_type_id)
        if event_type is None:
            raise HTTPException(status_code=404, detail="Event type not found")

        session.delete(event_type)
        return {"message": "Event type deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=str(e))
