from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, Literal


class SosPacketIn(BaseModel):
    message_id: str
    original_timestamp: int
    received_timestamp: Optional[int] = None
    lat: float = Field(..., ge=-90, le=90)
    lon: float = Field(..., ge=-180, le=180)
    severity: Literal["low", "medium", "high", "critical"]
    request_type: str
    ttl: int = Field(..., ge=0)


class SosPacketDB(BaseModel):
    message_id: str
    original_timestamp: int
    received_timestamp: int
    lat: float
    lon: float
    severity: str
    request_type: str
    ttl: int
    status: Literal["active", "resolved", "expired"] = "active"

    model_config = ConfigDict(populate_by_name=True)


class SosPacketUpdate(BaseModel):
    status: Literal["active", "resolved", "expired"]