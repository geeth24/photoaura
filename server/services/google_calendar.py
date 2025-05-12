from google.oauth2 import service_account
from googleapiclient.discovery import build
import os
import json
from datetime import datetime, timedelta
from services.email_service import send_booking_confirmation, create_calendar_invite

# Load Google Calendar credentials from environment variable
CREDENTIALS_JSON = os.environ.get("GOOGLE_CALENDAR_CREDENTIALS")
CALENDAR_ID = os.environ.get("GOOGLE_CALENDAR_ID")

# NOTE: Service accounts cannot send calendar invitations without Domain-Wide Delegation
# We'll create calendar events and send email notifications instead

credentials = service_account.Credentials.from_service_account_info(
    json.loads(CREDENTIALS_JSON), scopes=["https://www.googleapis.com/auth/calendar"]
)

calendar_service = build("calendar", "v3", credentials=credentials)


async def create_calendar_event(
    client_name: str,
    client_email: str,
    date: datetime,
    notes: str = None,
    service_type: str = "Photography",
):
    # Ensure service_type has a default value if None
    if service_type is None:
        service_type = "Photography"

    # Convert string date to datetime if needed
    if isinstance(date, str):
        try:
            date = datetime.fromisoformat(date.replace("Z", "+00:00"))
        except (ValueError, TypeError):
            date = datetime.now()

    # End time (2 hours after start)
    end_time = date + timedelta(hours=2)

    # Create event for Google Calendar
    event = {
        "summary": f"Reactive Shots - {service_type.title()} Session - {client_name}",
        "description": f"""
Client: {client_name}
Email: {client_email}
Service Type: {service_type}
Notes: {notes or 'None provided'}

Reactive Shots Team
Contact: geeth@reactiveshots.com
""",
        "start": {
            "dateTime": date.isoformat(),
            "timeZone": "UTC",
        },
        "end": {
            "dateTime": end_time.isoformat(),  # Default 2-hour session
            "timeZone": "UTC",
        },
        # Removing attendees to avoid the service account permission issue
    }

    # Create the event in Google Calendar
    event = (
        calendar_service.events().insert(calendarId=CALENDAR_ID, body=event).execute()
    )

    # Generate iCalendar file content
    event_summary = f"Reactive Shots - {service_type.title()} Session"
    event_description = f"""
Your {service_type} session with Reactive Shots has been confirmed.

Date: {date.strftime('%B %d, %Y')}
Time: {date.strftime('%I:%M %p')} - {end_time.strftime('%I:%M %p')}

{notes or ''}

If you need to make any changes to this booking, please contact us.
Contact: geeth@reactiveshots.com
"""
    location = ""  # Add if you have a location field
    attendees = [{"email": client_email, "name": client_name}]

    # Create the iCalendar content
    ical_content = create_calendar_invite(
        summary=event_summary,
        description=event_description,
        start_time=date,
        end_time=end_time,
        location=location,
        attendees=attendees,
    )

    # Send a confirmation email with appointment details and calendar invite
    try:
        await send_booking_confirmation(
            client_email,
            client_name,
            date,
            service_type,
            is_approved=True,  # This will be used to modify the email template
            ical_content=ical_content,  # Pass the iCalendar content
        )
    except Exception as e:
        print(f"Error sending confirmation email: {str(e)}")

    return event["id"]
