from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, Literal


class SosPacketIn(BaseModel):
    message_id: str
    original_timestamp: int
    received_timestamp: Optional[int] = None
    lat: float = Field(..., ge=-90, le=90)
    lon: float = Field(..., ge=-180, le=180)
    severity: str  # self-signaled urgency, not a diagnosis of the emergency
    request_type: str = "SOS SIGNAL"  # unclassified until a responder arrives on scene
    ttl: int = Field(..., ge=0)
    location_source: Literal["GPS FIX", "IP GEO"] = "GPS FIX"
    ip_address: Optional[str] = None  # only meaningful when location_source is "IP GEO"


class SosPacketDB(BaseModel):
    message_id: str
    original_timestamp: int
    received_timestamp: int
    lat: float
    lon: float
    severity: str
    request_type: str
    ttl: int
    location_source: Literal["GPS FIX", "IP GEO"] = "GPS FIX"
    ip_address: Optional[str] = None
    status: Literal["pending", "completed"] = "pending"

    model_config = ConfigDict(populate_by_name=True)


class SosPacketUpdate(BaseModel):
    status: Literal["pending", "completed"]