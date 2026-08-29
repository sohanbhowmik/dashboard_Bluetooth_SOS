from pydantic import BaseModel, Field, ConfigDict
from typing import Optional

class SosPacketIn(BaseModel):
    message_id: str
    original_timestamp: int
    received_timestamp: Optional[int] = None
    lat: float
    lon: float
    severity: str
    request_type: str
    ttl: int

class SosPacketDB(BaseModel):
    message_id: str
    original_timestamp: int
    received_timestamp: int
    lat: float
    lon: float
    severity: str
    request_type: str
    ttl: int
    status: str

    model_config = ConfigDict(populate_by_name=True)

class SosPacketUpdate(BaseModel):
    status: str