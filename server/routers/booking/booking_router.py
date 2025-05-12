from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import OAuth2PasswordBearer
from datetime import datetime
from typing import Optional
from pydantic import BaseModel
from services.database import get_db
from services.google_calendar import create_calendar_event
from services.email_service import send_booking_confirmation
import os

router = APIRouter()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")


class BookingRequest(BaseModel):
    client_name: str
    client_email: str
    client_phone: str
    preferred_date: datetime
    service_type_id: int
    additional_notes: Optional[str] = None


class PricingRequest(BaseModel):
    session_type: str
    price: float
    notes: Optional[str] = None

@router.get("/api/bookings")
async def get_bookings(token: str = Depends(oauth2_scheme)):
    db, cursor = get_db()
    try:
        cursor.execute("SELECT * FROM bookings ORDER BY created_at DESC")
        bookings = cursor.fetchall()
        return bookings
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/bookings")
async def create_booking(booking: BookingRequest):
    db, cursor = get_db()
    try:
        # Verify service type exists
        cursor.execute(
            "SELECT * FROM service_types WHERE id = %s", (booking.service_type_id,)
        )
        service_type = cursor.fetchone()
        if not service_type:
            raise HTTPException(status_code=400, detail="Invalid service type")

        cursor.execute(
            """
            INSERT INTO bookings 
            (client_name, client_email, client_phone, preferred_date, service_type_id, additional_notes)
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING id
        """,
            (
                booking.client_name,
                booking.client_email,
                booking.client_phone,
                booking.preferred_date,
                booking.service_type_id,
                booking.additional_notes,
            ),
        )
        booking_id = cursor.fetchone()[0]
        db.commit()

        # Send confirmation email with service type
        service_type_name = service_type[1]
        await send_booking_confirmation(
            booking.client_email,
            booking.client_name,
            booking.preferred_date,
            service_type_name,
        )

        return {"id": booking_id, "message": "Booking request submitted successfully"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/api/bookings/{booking_id}/status")
async def update_booking_status(
    booking_id: int, status: str, token: str = Depends(oauth2_scheme)
):
    if status not in ["approved", "rejected"]:
        raise HTTPException(status_code=400, detail="Invalid status")

    db, cursor = get_db()
    try:
        cursor.execute("SELECT * FROM bookings WHERE id = %s", (booking_id,))
        booking = cursor.fetchone()

        if not booking:
            raise HTTPException(status_code=404, detail="Booking not found")

        if status == "approved":
            # Create Google Calendar event
            event_id = await create_calendar_event(
                booking[1],  # client_name
                booking[2],  # client_email
                booking[4],  # preferred_date
                booking[5],  # additional_notes
            )

            cursor.execute(
                """
                UPDATE bookings 
                SET status = %s, google_calendar_event_id = %s
                WHERE id = %s
            """,
                (status, event_id, booking_id),
            )
        else:
            cursor.execute(
                "UPDATE bookings SET status = %s WHERE id = %s", (status, booking_id)
            )

        db.commit()
        return {"message": f"Booking {status} successfully"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/pricing")
async def create_pricing(pricing: PricingRequest, token: str = Depends(oauth2_scheme)):
    db, cursor = get_db()
    try:
        cursor.execute(
            """
            INSERT INTO pricing 
            (session_type, price, notes)
            VALUES (%s, %s, %s)
            RETURNING id
        """,
            (pricing.session_type, pricing.price, pricing.notes),
        )
        pricing_id = cursor.fetchone()[0]
        db.commit()
        return {"id": pricing_id, "message": "Pricing created successfully"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/pricing")
async def get_pricing():
    db, cursor = get_db()
    try:
        cursor.execute("SELECT * FROM pricing ORDER BY created_at DESC")
        pricing = cursor.fetchall()
        return [
            {
                "id": p[0],
                "session_type": p[1],
                "price": float(p[2]),
                "notes": p[3],
                "created_at": p[4],
            }
            for p in pricing
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/service-types")
async def get_service_types():
    db, cursor = get_db()
    try:
        cursor.execute("SELECT * FROM service_types ORDER BY name")
        services = cursor.fetchall()
        return [
            {"id": service[0], "name": service[1], "created_at": service[2]}
            for service in services
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/bookings/{booking_id}")
async def get_booking(booking_id: int, token: str = Depends(oauth2_scheme)):
    db, cursor = get_db()
    try:
        cursor.execute(
            """
            SELECT b.*, st.name as service_type 
            FROM bookings b
            JOIN service_types st ON b.service_type_id = st.id
            WHERE b.id = %s
        """,
            (booking_id,),
        )

        booking = cursor.fetchone()
        if not booking:
            raise HTTPException(status_code=404, detail="Booking not found")

        return {
            "id": booking[0],
            "client_name": booking[1],
            "client_email": booking[2],
            "client_phone": booking[3],
            "preferred_date": booking[4],
            "additional_notes": booking[5],
            "status": booking[6],
            "google_calendar_event_id": booking[7],
            "created_at": booking[8],
            "service_type": booking[10],  # From the joined service_types table
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
