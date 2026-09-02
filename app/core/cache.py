import json
import random
from typing import Any
import redis.asyncio as aioredis
from app.core.logger import get_logger

logger = get_logger(__name__)

CACHE_TTL = {
    "rankings_latest": 82_800,     
    "rankings_history": 82_800,    
    "activity": 82_800,            
    "h2h": 82_800,                 
    "listing_audit": 82_800,       
    "apps_list": 300,              
    "apps_last_sync": 300,         
    "competitors": 300,            
    "integrations_slack": 300,     
}


def get_ttl_with_jitter(
    base_ttl: int,
    jitter_percent: float = 0.05,
) -> int:
    """
    Calculate a cache TTL with a small randomized jitter.

    A random adjustment of +/- the configured percentage is applied to the
    base TTL. This helps prevent multiple cache entries from expiring at the
    exact same time and reduces the risk of a cache stampede.

    Args:
        base_ttl: Base cache lifetime in seconds.
        jitter_percent: Maximum percentage by which the TTL may vary.
            Defaults to 5%.

    Returns:
        The adjusted TTL in seconds.

    Raises:
        No exceptions are intentionally propagated. Invalid values are logged
        and the original base TTL is returned.
    """
    try:
        jitter = int(base_ttl * jitter_percent)

        if jitter <= 0:
            return base_ttl

        return base_ttl + random.randint(-jitter, jitter)

    except Exception as exc:
        logger.exception(
            "Failed to calculate TTL jitter for base_ttl=%s: %s",
            base_ttl,
            exc,
        )
        return base_ttl


def make_key(*parts: Any) -> str:
    """
    Build a namespaced Redis cache key.

    All generated keys are prefixed with ``cache`` to provide a consistent
    namespace and avoid collisions with unrelated Redis keys.

    Args:
        *parts: Values that make up the remainder of the cache key.

    Returns:
        A colon-separated Redis key string.

    Raises:
        No exceptions are intentionally propagated. Values are converted to
        strings before constructing the key.
    """
    try:
        return ":".join(str(part) for part in ["cache", *parts])

    except Exception as exc:
        logger.exception(
            "Failed to construct Redis cache key from parts=%s: %s",
            parts,
            exc,
        )
        raise


async def cache_get(
    redis: aioredis.Redis | None,
    key: str,
) -> Any | None:
    """
    Retrieve and deserialize a cached JSON value from Redis.

    Redis failures and JSON deserialization errors are handled gracefully.
    Returning None allows callers to treat Redis failures as normal cache
    misses and continue using the underlying data source.

    Args:
        redis: Active asynchronous Redis client, or None when Redis is
            unavailable.
        key: Redis cache key to retrieve.

    Returns:
        The deserialized cached value, or None if the key does not exist,
        Redis is unavailable, or the cached value cannot be decoded.

    Raises:
        No exceptions are propagated.
    """
    if redis is None:
        logger.debug("Cache GET skipped because Redis is unavailable: key=%s", key)
        return None

    try:
        value = await redis.get(key)

        if value is not None:
            logger.debug("Cache HIT for key=%s", key)
            return json.loads(value)

        logger.debug("Cache MISS for key=%s", key)

    except Exception as exc:
        logger.exception(
            "Cache GET failed for key=%s: %s",
            key,
            exc,
        )

    return None


async def cache_set(
    redis: aioredis.Redis | None,
    key: str,
    value: Any,
    ttl: int,
) -> None:
    """
    Serialize and store a value in Redis with an expiration time.

    The supplied TTL is randomized slightly using
    :func:`get_ttl_with_jitter` to reduce synchronized cache expiration.

    Args:
        redis: Active asynchronous Redis client, or None when Redis is
            unavailable.
        key: Redis cache key.
        value: JSON-serializable value to cache.
        ttl: Base cache lifetime in seconds.

    Returns:
        None.

    Raises:
        No exceptions are propagated. Serialization and Redis errors are
        logged and the cache operation is skipped.
    """
    if redis is None:
        logger.debug("Cache SET skipped because Redis is unavailable: key=%s", key)
        return

    try:
        final_ttl = get_ttl_with_jitter(ttl)
        serialized_value = json.dumps(value)

        await redis.set(
            key,
            serialized_value,
            ex=final_ttl,
        )

        logger.debug(
            "Cache SET for key=%s (ttl=%ds)",
            key,
            final_ttl,
        )

    except Exception as exc:
        logger.exception(
            "Cache SET failed for key=%s: %s",
            key,
            exc,
        )


async def cache_invalidate_pattern(
    redis: aioredis.Redis | None,
    pattern: str,
) -> None:
    """
    Delete all Redis cache keys matching a pattern.

    Uses Redis ``SCAN`` iteration through ``scan_iter`` instead of ``KEYS`` so
    that invalidation does not block Redis while scanning a large keyspace.

    Args:
        redis: Active asynchronous Redis client, or None when Redis is
            unavailable.
        pattern: Redis glob-style pattern identifying keys to invalidate.

    Returns:
        None.

    Raises:
        No exceptions are propagated. Redis errors are logged and the
        invalidation operation is aborted.
    """
    if redis is None:
        logger.debug(
            "Cache invalidation skipped because Redis is unavailable: pattern=%s",
            pattern,
        )
        return

    try:
        count = 0

        async for key in redis.scan_iter(match=pattern):
            await redis.delete(key)
            count += 1

        if count > 0:
            logger.info(
                "Cache INVALIDATED %d key(s) matching pattern=%s",
                count,
                pattern,
            )
        else:
            logger.debug(
                "Cache invalidation found no matching keys for pattern=%s",
                pattern,
            )

    except Exception as exc:
        logger.exception(
            "Cache invalidation failed for pattern=%s: %s",
            pattern,
            exc,
        )