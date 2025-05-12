from google.oauth2 import service_account
from googleapiclient.discovery import build
import os
import json
from datetime import datetime, timedelta

# Load Google Calendar credentials from environment variable
CREDENTIALS_JSON = os.environ.get("GOOGLE_CALENDAR_CREDENTIALS")
CALENDAR_ID = os.environ.get("GOOGLE_CALENDAR_ID")

credentials = service_account.Credentials.from_service_account_info(
    json.loads(CREDENTIALS_JSON), scopes=["https://www.googleapis.com/auth/calendar"]
)

calendar_service = build("calendar", "v3", credentials=credentials)


async def create_calendar_event(
    client_name: str,
    client_email: str,
    date: str,
    notes: str = None,
    service_type: str = None,
):
    event = {
        "summary": f"{service_type.title()} Session - {client_name}",
        "description": f"""
Client: {client_name}
Email: {client_email}
Service Type: {service_type}
Notes: {notes}
""",
        "start": {
            "dateTime": date.isoformat(),
            "timeZone": "UTC",
        },
        "end": {
            "dateTime": (
                date + timedelta(hours=2)
            ).isoformat(),  # Default 2-hour session
            "timeZone": "UTC",
        },
        "attendees": [
            {"email": client_email},
        ],
    }

    event = (
        calendar_service.events().insert(calendarId=CALENDAR_ID, body=event).execute()
    )
    return event["id"]
