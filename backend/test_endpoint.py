#!/usr/bin/env python
"""Quick test script to debug the property endpoint."""
from fastapi.testclient import TestClient
import sys
import asyncio
import traceback

# Add current dir to path
sys.path.insert(0, '.')

try:
    print("Importing app...")
    from app.main import app
    print("App imported successfully")

    print("Creating test client...")
    client = TestClient(app)
    print("Client created")

    print("Making request to /api/v1/property/1378995/report...")
    response = client.get("/api/v1/property/1378995/report", headers={"Host": "localhost:8000"})
    print(f"Response status: {response.status_code}")
    print(f"Response content: {response.content}")
    print(f"Response text: {response.text}")
    if response.text:
        print(f"Response JSON: {response.json()}")
except Exception as e:
    print(f"Error: {e}")
    traceback.print_exc()
