import os
from motor.motor_asyncio import AsyncIOMotorClient
import pymongo
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")

client = AsyncIOMotorClient(MONGO_URI)
db = client.disaster_mesh
sos_collection = db.sos_requests

async def init_db():
    """Create unique index on message_id to ensure fast deduplication."""
    await sos_collection.create_index(
        [("message_id", pymongo.ASCENDING)], 
        unique=True
    )