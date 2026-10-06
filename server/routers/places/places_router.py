import os
from typing import List, Optional

import requests
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response

from dependencies import get_current_user, require_admin

router = APIRouter()

# server-side only: the key is never sent to browsers
MAPS_KEY = os.environ.get("GOOGLE_MAPS_API_KEY", "")
PLACES = "https://places.googleapis.com/v1"
# bias suggestions toward DFW, where nearly every shoot happens
DFW = {"circle": {"center": {"latitude": 32.85, "longitude": -96.95}, "radius": 50000.0}}

# dark map to match the app; pins in the brand blue
DARK_STYLE = [
    "element:geometry|color:0x0b1622",
    "element:labels.text.fill|color:0x8a9aab",
    "element:labels.text.stroke|color:0x0b1622",
    "feature:road|element:geometry|color:0x1b2a3a",
    "feature:road.highway|element:geometry|color:0x24384d",
    "feature:water|element:geometry|color:0x050d14",
    "feature:poi|visibility:off",
    "feature:transit|visibility:off",
    "feature:administrative|element:geometry|visibility:off",
]


def _key():
    if not MAPS_KEY:
        raise HTTPException(status_code=503, detail="Maps isn't configured")
    return MAPS_KEY


@router.get("/api/places/autocomplete")
def autocomplete(
    q: str = Query(..., min_length=2, max_length=200),
    session: Optional[str] = None,
    _admin=Depends(require_admin),
):
    body = {"input": q, "includedRegionCodes": ["us"], "locationBias": DFW}
    if session:
        body["sessionToken"] = session
    r = requests.post(
        f"{PLACES}/places:autocomplete",
        json=body,
        headers={"X-Goog-Api-Key": _key()},
        timeout=8,
    )
    if r.status_code != 200:
        raise HTTPException(status_code=502, detail="Address lookup failed")
    out = []
    for s in r.json().get("suggestions", []):
        p = s.get("placePrediction")
        if not p:
            continue
        fmt = p.get("structuredFormat", {})
        out.append(
            {
                "place_id": p.get("placeId"),
                "text": p.get("text", {}).get("text", ""),
                "main": fmt.get("mainText", {}).get("text", ""),
                "secondary": fmt.get("secondaryText", {}).get("text", ""),
            }
        )
    return out


@router.get("/api/places/{place_id}")
def place(place_id: str, session: Optional[str] = None, _admin=Depends(require_admin)):
    params = {"sessionToken": session} if session else {}
    r = requests.get(
        f"{PLACES}/places/{place_id}",
        params=params,
        headers={
            "X-Goog-Api-Key": _key(),
            "X-Goog-FieldMask": "displayName,formattedAddress,location,types",
        },
        timeout=8,
    )
    if r.status_code != 200:
        raise HTTPException(status_code=502, detail="Place lookup failed")
    d = r.json()
    address = (d.get("formattedAddress") or "").removesuffix(", USA")
    name = d.get("displayName", {}).get("text", "")
    # a venue's name reads better than its street ("Hilton Anatole, 2201 N Stemmons Fwy…");
    # a bare street address already starts with its own name
    is_address = any(t in (d.get("types") or []) for t in ("street_address", "premise", "subpremise"))
    label = address if is_address or not name or address.startswith(name) else f"{name}, {address}"
    loc = d.get("location") or {}
    return {"label": label, "address": address, "name": name, "lat": loc.get("latitude"), "lng": loc.get("longitude")}


@router.get("/api/maps/static.png")
def static_map(
    stops: List[str] = Query(..., max_length=8),
    w: int = Query(640, ge=200, le=640),
    h: int = Query(280, ge=120, le=640),
    _user=Depends(get_current_user),
):
    """A dark map with a numbered pin per stop. Stops are addresses; Google
    geocodes them, so nothing needs coordinates stored."""
    stops = [s.strip() for s in stops if s and s.strip()][:8]
    if not stops:
        raise HTTPException(status_code=400, detail="No stops")
    params = [("size", f"{w}x{h}"), ("scale", "2"), ("key", _key())]
    params += [("style", s) for s in DARK_STYLE]
    for i, stop in enumerate(stops, start=1):
        params.append(("markers", f"color:0x00A6FB|label:{i}|{stop}"))
    if len(stops) == 1:
        params.append(("zoom", "14"))
    r = requests.get("https://maps.googleapis.com/maps/api/staticmap", params=params, timeout=10)
    if r.status_code != 200 or not r.headers.get("content-type", "").startswith("image/"):
        raise HTTPException(status_code=502, detail="Map failed to load")
    return Response(content=r.content, media_type=r.headers["content-type"], headers={"Cache-Control": "private, max-age=86400"})
