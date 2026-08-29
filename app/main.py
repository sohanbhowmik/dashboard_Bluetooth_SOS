from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
from typing import List
import json

from app.database import init_db
from app.routes import router

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        # Convert dictionary to JSON string to ensure clean transmission
        payload = json.dumps(message)
        for connection in self.active_connections:
            try:
                await connection.send_text(payload)
            except Exception:
                pass # Client disconnected abruptly

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize Database indexes
    await init_db()
    yield
    # Shutdown logic can go here

app = FastAPI(title="Disaster Mesh API", lifespan=lifespan)

# Allow CORS for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize and attach WebSocket manager to app state for cross-file dependency injection
ws_manager = ConnectionManager()
app.state.ws_manager = ws_manager

# Include REST Routes
app.include_router(router)

# WebSocket Endpoint
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        while True:
            # Keep connection alive, listen for pings/messages from client
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)

# Mount Static Files (Must be done after API routes to avoid overriding them)
# NOTE: This expects index.html to live INSIDE the static/ folder, not at project root.
# With html=True, FastAPI serves static/index.html automatically at "/".
app.mount("/", StaticFiles(directory="static", html=True), name="static")