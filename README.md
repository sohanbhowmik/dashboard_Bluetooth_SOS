# Disaster Mesh Dashboard

A real-time, offline-first mesh network visualization dashboard. This tool receives SOS requests that have hopped through a Bluetooth mesh network, deduplicates them, and visualizes them on a live map for rescue coordinators.

## Tech Stack
- **Backend**: Python 3.11+, FastAPI, Motor (MongoDB Async), WebSockets
- **Frontend**: Vanilla HTML/JS/CSS, Leaflet.js
- **Database**: MongoDB (Local Installation)

## Local Setup Instructions (No Docker)

### Step 1: Install MongoDB
You must have MongoDB running on your computer. 
1. Download **MongoDB Community Server** from the official MongoDB website.
2. Install it with the default settings (it will automatically run in the background on port `27017`).

### Step 2: Set Up Python Environment
Open your terminal (or VS Code integrated terminal) in this project folder and run:

**On Windows:**
```bash
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt