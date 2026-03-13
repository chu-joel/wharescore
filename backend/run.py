#!/usr/bin/env python
"""
Wrapper script to run uvicorn with SelectorEventLoop on Windows.
Fixes psycopg3 compatibility with Python 3.14+ ProactorEventLoop.
"""
import asyncio
import sys

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

import uvicorn

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=False,
        log_level="info",
    )
