import asyncio
from contextlib import asynccontextmanager

from sqlalchemy import text
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.logger import get_logger
from app.core.telemetry import setup_telemetry

setup_telemetry()

logger = get_logger(__name__)


def _open_one_connection() -> None:
    """Open a single connection, ping it, and return it to the pool."""
    from app.db.database_config import engine
    conn = engine.connect()
    conn.execute(text("SELECT 1"))
    conn.close()


def _prewarm_pool() -> None:
    """
    Open pool_size connections concurrently so the pool is fully populated
    before the first request arrives.

    All connections are opened in parallel via ThreadPoolExecutor, so the
    total startup cost is ~1 round trip (~400 ms) instead of
    pool_size × 1 round trip (which was ~21 s sequentially).
    """
    from concurrent.futures import ThreadPoolExecutor, as_completed
    from app.db.database_config import engine

    pool_size = engine.pool.size()
    logger.info("Pre-warming connection pool (%d connections in parallel)...", pool_size)

    errors = []
    with ThreadPoolExecutor(max_workers=pool_size) as executor:
        futures = [executor.submit(_open_one_connection) for _ in range(pool_size)]
        for future in as_completed(futures):
            exc = future.exception()
            if exc:
                errors.append(exc)

    if errors:
        logger.warning(
            "Pool pre-warm completed with %d error(s): %s",
            len(errors),
            errors[0],
        )
    else:
        logger.info("Connection pool pre-warmed successfully (%d connections).", pool_size)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: pre-warm DB pool on startup."""
    await asyncio.to_thread(_prewarm_pool)
    yield


app = FastAPI(
    title="Shopify Rank Tracker API",
    description="API for tracking Shopify app keyword rankings, persisting history, and retrieving ranking data.",
    version="2.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
    root_path="/api",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {"message": "Welcome to Shopify Rank Tracker API"}

app.include_router(api_router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
