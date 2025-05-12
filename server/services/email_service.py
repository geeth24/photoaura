import os
import resend
from datetime import datetime
from icalendar import Calendar, Event
import uuid

resend.api_key = os.environ.get("RESEND_API_KEY")


async def send_booking_confirmation(
    email: str,
    name: str,
    date: datetime,
    service_type: str,
    is_approved: bool = False,
    ical_content=None,
):
    try:
        if is_approved:
            subject = "Booking Approved - Your Appointment is Confirmed"
            html_content = f"""
                <h1>Reactive Shots - Booking Approved</h1>
                <p>Dear {name},</p>
                <p>Your booking request for {service_type} services has been approved!</p>
                <p><strong>Date and Time:</strong> {date.strftime('%B %d, %Y at %I:%M %p')}</p>
                <p><strong>Service Type:</strong> {service_type}</p>
                
                <div style="margin: 20px 0; padding: 15px; border: 1px solid #ccc; border-radius: 5px; background-color: #f9f9f9;">
                    <p style="margin-top: 0;"><strong>Add to your calendar:</strong></p>
                    <p>You can add this appointment to your calendar using the attached .ics file or the following details:</p>
                    <ul>
                        <li>Date: {date.strftime('%B %d, %Y')}</li>
                        <li>Start Time: {date.strftime('%I:%M %p')}</li>
                        <li>Duration: 2 hours</li>
                        <li>Title: Reactive Shots - {service_type} Session</li>
                    </ul>
                </div>
                
                <p>If you need to make any changes to your booking, please contact us as soon as possible.</p>
                <p>We look forward to seeing you!</p>
                <p>Reactive Shots Team</p>
            """
        else:
            subject = "Reactive Shots - Booking Confirmation"
            html_content = f"""
                <h1>Reactive Shots - Booking Confirmation</h1>
                <p>Dear {name},</p>
                <p>Your booking request for {service_type} services on 
                {date.strftime('%B %d, %Y at %I:%M %p')} has been received.</p>
                <p>We will review your request and get back to you shortly.</p>
                <p>Service Type: {service_type}</p>
                <p>Reactive Shots Team</p>
            """

        params: resend.Emails.SendParams = {
            "from": "Reactive Shots <booking@contact.geeth.co>",
            "to": [email],
            "reply_to": "geeth@reactiveshots.com",
            "subject": subject,
            "html": html_content,
        }

        # Add calendar attachment if available
        if ical_content and is_approved:
            params["attachments"] = [
                {
                    "filename": f"{service_type.replace(' ', '')}_booking.ics",
                    "content": ical_content,
                }
            ]

        email_response = resend.Emails.send(params)
        print(f"Email sent: {email_response}")
    except Exception as e:
        print(f"Failed to send email: {str(e)}")
        # Don't raise exception - email sending should not block the booking process


def create_calendar_invite(
    summary: str,
    description: str,
    start_time: datetime,
    end_time: datetime,
    location: str = "",
    organizer_email: str = "booking@reactiveshots.com",
    organizer_name: str = "Reactive Shots",
    attendees=None,
):
    """
    Creates an iCalendar (.ics) file content

    Args:
        summary: Title of the event
        description: Description of the event
        start_time: Start time of the event
        end_time: End time of the event
        location: Location of the event
        organizer_email: Email of the organizer
        organizer_name: Name of the organizer
        attendees: List of dictionaries with 'email' and 'name' keys

    Returns:
        String content of the ICS file
    """
    cal = Calendar()
    cal.add("prodid", "-//Reactive Shots//Booking System//EN")
    cal.add("version", "2.0")
    cal.add(
        "method", "REQUEST"
    )  # This makes it an invitation rather than just an event

    event = Event()
    event.add("summary", summary)
    event.add("description", description)
    event.add("dtstart", start_time)
    event.add("dtend", end_time)
    event.add("location", location)

    # Add a unique identifier
    event["uid"] = f"{uuid.uuid4()}@reactiveshots.com"

    # Add organizer
    event.add(
        "organizer", f"mailto:{organizer_email}", parameters={"cn": organizer_name}
    )

    # Add attendees if provided
    if attendees:
        for attendee in attendees:
            event.add(
                "attendee",
                f"mailto:{attendee['email']}",
                parameters={"cn": attendee.get("name", ""), "role": "REQ-PARTICIPANT"},
            )

    # Add to calendar
    cal.add_component(event)

    return cal.to_ical().decode("utf-8")


async def send_video_upload_notification(email: str, name: str, video_title: str):
    try:
        params: resend.Emails.SendParams = {
            "from": "Reactive Shots <notifications@contact.geethg.com>",
            "to": [email],
            "reply_to": "geeth@reactiveshots.com",
            "subject": "Reactive Shots - New Video Upload",
            "html": f"""
                <h1>Reactive Shots - New Video Upload</h1>
                <p>Dear {name},</p>
                <p>A new video "{video_title}" has been uploaded to your account.</p>
                <p>You can view it in your dashboard.</p>
                <p>Reactive Shots Team</p>
            """,
        }
        email_response = resend.Emails.send(params)
        print(f"Email sent: {email_response}")
    except Exception as e:
        print(f"Failed to send video upload notification: {str(e)}")


async def send_revision_notification(
    email: str, name: str, video_title: str, version: int
):
    try:
        params: resend.Emails.SendParams = {
            "from": "Reactive Shots <notifications@contact.geethg.com>",
            "to": [email],
            "reply_to": "geeth@reactiveshots.com",
            "subject": "Reactive Shots - New Video Revision Available",
            "html": f"""
                <h1>Reactive Shots - New Video Revision</h1>
                <p>Dear {name},</p>
                <p>A new revision (version {version}) is available for your video "{video_title}".</p>
                <p>You can view it in your dashboard.</p>
                <p>Note: This revision will be available for 2 weeks unless marked for permanent storage.</p>
                <p>Reactive Shots Team</p>
            """,
        }
        email_response = resend.Emails.send(params)
        print(f"Email sent: {email_response}")
    except Exception as e:
        print(f"Failed to send revision notification: {str(e)}")
