# backend/app/db.py
from __future__ import annotations
from concurrent.futures import ThreadPoolExecutor
from psycopg import connect as psycopg_connect
from psycopg.rows import dict_row
import asyncio

pool = None
executor = ThreadPoolExecutor(max_workers=20)


class AsyncPoolWrapper:
    """Wrapper around synchronous psycopg3 connection for async interface."""
    def __init__(self, conninfo: str):
        self.conninfo = conninfo

    def connection(self):
        """Get a connection context manager."""
        return _ConnectionContextManager(self.conninfo)


class _ConnectionContextManager:
    """Async context manager that executes sync psycopg3 in thread pool."""
    def __init__(self, conninfo: str):
        self.conninfo = conninfo
        self.conn = None
        self.loop = None

    async def __aenter__(self):
        self.loop = asyncio.get_event_loop()
        self.conn = await self.loop.run_in_executor(
            executor,
            lambda: psycopg_connect(self.conninfo, row_factory=dict_row)
        )
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.conn:
            if exc_type is None:
                await self.loop.run_in_executor(executor, self.conn.commit)
            await self.loop.run_in_executor(executor, self.conn.close)

    async def commit(self):
        """Explicitly commit the transaction."""
        if self.conn:
            await self.loop.run_in_executor(executor, self.conn.commit)

    async def execute(self, query, params=None):
        """Execute query in thread pool and return a cursor-like object."""
        def _execute():
            cur = self.conn.cursor()
            cur.execute(query, params or [])
            # Only fetch for SELECT/RETURNING queries — INSERTs/UPDATEs have no rows
            try:
                rows = cur.fetchall()
            except Exception:
                rows = []
            cur.close()
            return rows

        rows = await self.loop.run_in_executor(executor, _execute)
        return _CursorLike(rows)


class _CursorLike:
    """Cursor-like object that holds pre-fetched rows."""
    def __init__(self, rows):
        self.rows = rows
        self._index = 0

    def fetchone(self):
        """Return first row."""
        return self.rows[0] if self.rows else None

    def fetchall(self):
        """Return all rows."""
        return self.rows

    def close(self):
        """No-op for compatibility."""
        pass

    async def commit(self):
        """Commit in thread pool."""
        await self.loop.run_in_executor(executor, self.conn.commit)


async def init_pool(conninfo: str):
    """Create async connection pool wrapper."""
    global pool
    pool = AsyncPoolWrapper(conninfo)


async def close_pool():
    """Shutdown thread pool."""
    executor.shutdown(wait=True)
