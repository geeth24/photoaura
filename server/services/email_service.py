import os
import resend
from datetime import datetime

resend.api_key = os.environ.get("RESEND_API_KEY")


async def send_booking_confirmation(
    email: str, name: str, date: datetime, service_type: str
):
    try:
        params: resend.Emails.SendParams = {
            "from": "Booking <booking@contact.geethg.com>",
            "to": [email],
            "subject": "Booking Confirmation",
            "html": f"""
                <h1>Booking Confirmation</h1>
                <p>Dear {name},</p>
                <p>Your booking request for {service_type} services on 
                {date.strftime('%B %d, %Y at %I:%M %p')} has been received.</p>
                <p>We will review your request and get back to you shortly.</p>
                <p>Service Type: {service_type}</p>
            """,
        }
        email_response = resend.Emails.send(params)
        print(f"Email sent: {email_response}")
    except Exception as e:
        print(f"Failed to send email: {str(e)}")
        # Don't raise exception - email sending should not block the booking process


async def send_video_upload_notification(email: str, name: str, video_title: str):
    try:
        params: resend.Emails.SendParams = {
            "from": "Notifications <notifications@contact.geethg.com>",
            "to": [email],
            "subject": "New Video Upload",
            "html": f"""
                <h1>New Video Upload</h1>
                <p>Dear {name},</p>
                <p>A new video "{video_title}" has been uploaded to your account.</p>
                <p>You can view it in your dashboard.</p>
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
            "from": "Notifications <notifications@contact.geethg.com>",
            "to": [email],
            "subject": "New Video Revision Available",
            "html": f"""
                <h1>New Video Revision</h1>
                <p>Dear {name},</p>
                <p>A new revision (version {version}) is available for your video "{video_title}".</p>
                <p>You can view it in your dashboard.</p>
                <p>Note: This revision will be available for 2 weeks unless marked for permanent storage.</p>
            """,
        }
        email_response = resend.Emails.send(params)
        print(f"Email sent: {email_response}")
    except Exception as e:
        print(f"Failed to send revision notification: {str(e)}")
