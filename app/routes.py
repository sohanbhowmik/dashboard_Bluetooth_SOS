import time
from typing import List
from fastapi import APIRouter, Request, HTTPException
from pymongo import UpdateOne
from app.models import SosPacketIn, SosPacketDB
from app.database import sos_collection

router = APIRouter()

@router.post("/api/sos", response_model=dict)
async def ingest_sos_packets(packets: List[SosPacketIn], request: Request):
    if not packets:
        return {"inserted": 0}

    operations = []
    current_time = int(time.time())
    processed_message_ids = []

    for packet in packets:
        doc = packet.model_dump()
        doc["status"] = "pending"
        if not doc.get("received_timestamp"):
            doc["received_timestamp"] = current_time
        
        # Upsert: Insert if not exists, do nothing if it does exist (deduplication)
        operations.append(
            UpdateOne(
                {"message_id": doc["message_id"]},
                {"$setOnInsert": doc},
                upsert=True
            )
        )
        processed_message_ids.append(doc["message_id"])

    if operations:
        result = await sos_collection.bulk_write(operations)
        
        # If any documents were newly inserted, fetch them and broadcast via WebSocket
        if result.upserted_count > 0:
            # Find the newly inserted pending documents
            cursor = sos_collection.find({
                "message_id": {"$in": processed_message_ids},
                "status": "pending"
            })
            new_docs = await cursor.to_list(length=None)
            
            # Remove MongoDB's internal _id for broadcasting
            broadcast_data = []
            for d in new_docs:
                d.pop("_id", None)
                broadcast_data.append(d)
                
            if broadcast_data:
                await request.app.state.ws_manager.broadcast({
                    "type": "new",
                    "data": broadcast_data
                })
                
        return {"inserted": result.upserted_count}
    return {"inserted": 0}

@router.get("/api/sos", response_model=List[SosPacketDB])
async def get_pending_requests():
    cursor = sos_collection.find({"status": "pending"}).sort("original_timestamp", -1)
    documents = await cursor.to_list(length=None)
    
    # Strip ObjectId to satisfy Pydantic
    for doc in documents:
        doc.pop("_id", None)
        
    return documents

@router.patch("/api/sos/{message_id}", response_model=dict)
async def complete_request(message_id: str, request: Request):
    result = await sos_collection.update_one(
        {"message_id": message_id},
        {"$set": {"status": "completed"}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Request not found")
        
    if result.modified_count > 0:
        await request.app.state.ws_manager.broadcast({
            "type": "removed",
            "message_id": message_id
        })
        
    return {"status": "completed"}