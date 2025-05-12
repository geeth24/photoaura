from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class EventType(BaseModel):
    id: Optional[int] = None
    name: str
    priority: Optional[int] = 0


class Event(BaseModel):
    id: Optional[int] = None
    name: str
    event_type_id: int
    event_date: datetime
    location: Optional[str] = None
    description: Optional[str] = None
    created_by: int
    created_at: Optional[datetime] = None


class EventResponse(Event):
    event_type: Optional[str] = None
    created_by_name: Optional[str] = None
