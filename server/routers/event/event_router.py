from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import OAuth2PasswordBearer
from typing import List
from models.event import Event, EventType, EventResponse
from services.database import get_db
from routers.auth.auth_router import verify_token

router = APIRouter()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")


@router.post("/api/event-types")
async def create_event_type(event_type: EventType, token: str = Depends(oauth2_scheme)):
    db, cursor = get_db()
    try:
        # Verify token
        credentials_exception = HTTPException(
            status_code=401,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
        verify_token(token, credentials_exception)

        cursor.execute(
            """
            INSERT INTO event_types (name, priority)
            VALUES (%s, %s)
            RETURNING id, name, priority, created_at
            """,
            (event_type.name, event_type.priority),
        )
        result = cursor.fetchone()
        db.commit()

        return {
            "id": result[0],
            "name": result[1],
            "priority": result[2],
            "created_at": result[3],
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/event-types")
async def get_event_types():
    db, cursor = get_db()
    try:
        cursor.execute(
            """
            SELECT id, name, priority, created_at
            FROM event_types
            ORDER BY priority DESC, name
            """
        )
        results = cursor.fetchall()

        return [
            {
                "id": result[0],
                "name": result[1],
                "priority": result[2],
                "created_at": result[3],
            }
            for result in results
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/events")
async def create_event(event: Event, token: str = Depends(oauth2_scheme)):
    db, cursor = get_db()
    try:
        # Verify token
        credentials_exception = HTTPException(
            status_code=401,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
        user_id = verify_token(token, credentials_exception)

        # Verify event type exists
        cursor.execute(
            "SELECT id FROM event_types WHERE id = %s", (event.event_type_id,)
        )
        if cursor.fetchone() is None:
            raise HTTPException(status_code=400, detail="Invalid event type")

        cursor.execute(
            """
            INSERT INTO events 
            (name, event_type_id, event_date, location, description, created_by)
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING id
            """,
            (
                event.name,
                event.event_type_id,
                event.event_date,
                event.location,
                event.description,
                user_id,
            ),
        )
        event_id = cursor.fetchone()[0]
        db.commit()

        return {"id": event_id, "message": "Event created successfully"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/events")
async def get_events(token: str = Depends(oauth2_scheme)):
    db, cursor = get_db()
    try:
        # Verify token
        credentials_exception = HTTPException(
            status_code=401,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
        verify_token(token, credentials_exception)

        cursor.execute(
            """
            SELECT e.id, e.name, e.event_type_id, et.name, e.event_date, 
                   e.location, e.description, e.created_by, u.full_name, e.created_at
            FROM events e
            JOIN event_types et ON e.event_type_id = et.id
            JOIN users u ON e.created_by = u.id
            ORDER BY e.event_date DESC
            """
        )
        events = cursor.fetchall()

        return [
            {
                "id": event[0],
                "name": event[1],
                "event_type_id": event[2],
                "event_type": event[3],
                "event_date": event[4],
                "location": event[5],
                "description": event[6],
                "created_by": event[7],
                "created_by_name": event[8],
                "created_at": event[9],
            }
            for event in events
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/events/{event_id}")
async def get_event(event_id: int, token: str = Depends(oauth2_scheme)):
    db, cursor = get_db()
    try:
        # Verify token
        credentials_exception = HTTPException(
            status_code=401,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
        verify_token(token, credentials_exception)

        cursor.execute(
            """
            SELECT e.id, e.name, e.event_type_id, et.name, e.event_date, 
                   e.location, e.description, e.created_by, u.full_name, e.created_at
            FROM events e
            JOIN event_types et ON e.event_type_id = et.id
            JOIN users u ON e.created_by = u.id
            WHERE e.id = %s
            """,
            (event_id,),
        )
        event = cursor.fetchone()

        if not event:
            raise HTTPException(status_code=404, detail="Event not found")

        return {
            "id": event[0],
            "name": event[1],
            "event_type_id": event[2],
            "event_type": event[3],
            "event_date": event[4],
            "location": event[5],
            "description": event[6],
            "created_by": event[7],
            "created_by_name": event[8],
            "created_at": event[9],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/api/events/{event_id}")
async def update_event(
    event_id: int, updated_event: Event, token: str = Depends(oauth2_scheme)
):
    db, cursor = get_db()
    try:
        # Verify token
        credentials_exception = HTTPException(
            status_code=401,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
        user_id = verify_token(token, credentials_exception)

        # Check if event exists
        cursor.execute("SELECT id FROM events WHERE id = %s", (event_id,))
        if cursor.fetchone() is None:
            raise HTTPException(status_code=404, detail="Event not found")

        # Verify event type exists
        cursor.execute(
            "SELECT id FROM event_types WHERE id = %s", (updated_event.event_type_id,)
        )
        if cursor.fetchone() is None:
            raise HTTPException(status_code=400, detail="Invalid event type")

        cursor.execute(
            """
            UPDATE events
            SET name = %s, event_type_id = %s, event_date = %s, 
                location = %s, description = %s
            WHERE id = %s
            """,
            (
                updated_event.name,
                updated_event.event_type_id,
                updated_event.event_date,
                updated_event.location,
                updated_event.description,
                event_id,
            ),
        )
        db.commit()

        return {"message": "Event updated successfully"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/api/events/{event_id}")
async def delete_event(event_id: int, token: str = Depends(oauth2_scheme)):
    db, cursor = get_db()
    try:
        # Verify token
        credentials_exception = HTTPException(
            status_code=401,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
        user_id = verify_token(token, credentials_exception)

        # Check if event exists
        cursor.execute("SELECT id FROM events WHERE id = %s", (event_id,))
        if cursor.fetchone() is None:
            raise HTTPException(status_code=404, detail="Event not found")

        cursor.execute("DELETE FROM events WHERE id = %s", (event_id,))
        db.commit()

        return {"message": "Event deleted successfully"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/api/event-types/{event_type_id}")
async def delete_event_type(event_type_id: int, token: str = Depends(oauth2_scheme)):
    db, cursor = get_db()
    try:
        # Verify token
        credentials_exception = HTTPException(
            status_code=401,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
        verify_token(token, credentials_exception)

        # Check if event type is being used by any events
        cursor.execute(
            "SELECT id FROM events WHERE event_type_id = %s LIMIT 1", (event_type_id,)
        )
        if cursor.fetchone() is not None:
            raise HTTPException(
                status_code=400,
                detail="Cannot delete event type that is being used by events",
            )

        # Check if event type exists
        cursor.execute("SELECT id FROM event_types WHERE id = %s", (event_type_id,))
        if cursor.fetchone() is None:
            raise HTTPException(status_code=404, detail="Event type not found")

        cursor.execute("DELETE FROM event_types WHERE id = %s", (event_type_id,))
        db.commit()

        return {"message": "Event type deleted successfully"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
