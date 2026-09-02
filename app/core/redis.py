import redis.asyncio as aioredis

from app.core.config import REDIS_URL
from app.core.logger import get_logger

logger = get_logger(__name__)

_redis_client: aioredis.Redis | None = None


async def init_redis() -> None:
    """
    Initialize the asynchronous Redis connection pool.

    Creates and validates the Redis client during application startup. If the
    connection cannot be established, Redis caching is disabled gracefully by
    setting the client to None so the application can continue operating
    without Redis.

    Raises:
        No exceptions are propagated. Redis initialization failures are
        logged and handled gracefully.
    """
    global _redis_client

    try:
        _redis_client = aioredis.from_url(
            REDIS_URL,
            encoding="utf-8",
            decode_responses=True,
            max_connections=20,
        )

        await _redis_client.ping()

        logger.info("Redis connection pool initialized successfully.")

    except Exception as exc:
        logger.exception(
            "Failed to initialize Redis connection pool: %s",
            exc,
        )
        _redis_client = None


async def close_redis() -> None:
    """
    Gracefully close the asynchronous Redis connection pool.

    Closes the active Redis connection during application shutdown and clears
    the global client reference. Any shutdown error is logged without being
    propagated.

    Raises:
        No exceptions are propagated. Redis shutdown failures are logged and
        handled gracefully.
    """
    global _redis_client

    try:
        if _redis_client:
            await _redis_client.aclose()
            logger.info("Redis connection pool closed successfully.")

    except Exception as exc:
        logger.exception(
            "Failed to close Redis connection pool: %s",
            exc,
        )

    finally:
        _redis_client = None


def get_redis() -> aioredis.Redis | None:
    """
    Return the currently initialized Redis client.

    This function is intended to be used as a FastAPI dependency for injecting
    the shared Redis client into route handlers. If Redis is unavailable or
    initialization failed, None is returned so callers can bypass caching.

    Returns:
        The initialized asynchronous Redis client, or None when Redis is
        unavailable.
    """
    try:
        return _redis_client
    except Exception as exc:
        logger.exception(
            "Failed to retrieve Redis client: %s",
            exc,
        )
        return None