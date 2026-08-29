import os
import logging
from motor.motor_asyncio import AsyncIOMotorClient
import pymongo
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("uvicorn")

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")

client = AsyncIOMotorClient(MONGO_URI, serverSelectionTimeoutMS=5000)
db = client.disaster_mesh
sos_collection = db.sos_requests

async def init_db():
    """Verify MongoDB connection, then create unique index on message_id for fast deduplication."""
    try:
        # Ping the server to confirm the connection actually works
        await client.admin.command("ping")
        logger.info("✅ MongoDB connection successful")
    except Exception as e:
        logger.error(f"❌ MongoDB connection failed: {e}")
        raise  # Stop startup if DB isn't reachable — better to fail loud than run broken

    await sos_collection.create_index(
        [("message_id", pymongo.ASCENDING)],
        unique=True
    )
    logger.info("✅ Index on 'message_id' ensured")