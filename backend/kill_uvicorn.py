#!/usr/bin/env python
"""Kill all Uvicorn processes."""
import subprocess
import time

# Find and kill all Python processes related to uvicorn
try:
    result = subprocess.run(
        ["powershell", "-Command", "Get-Process python | Where-Object {$_.CommandLine -match 'uvicorn'} | ForEach-Object {Stop-Process -Id $_.Id -Force}"],
        capture_output=True,
        text=True
    )
    print("Killed Uvicorn processes")
    time.sleep(2)

    # Alternative: use os.system to run taskkill
    import os
    # This might not work, but let's try
    os.system("taskkill /IM python.exe /F")

except Exception as e:
    print(f"Error: {e}")
