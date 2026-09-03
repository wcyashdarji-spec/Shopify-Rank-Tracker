import redis.asyncio as aioredis
from sqlalchemy.orm import Session
from fastapi import APIRouter, Depends, HTTPException
from app.db import get_db
from app.db.models.user import User
from app.core.logger import get_logger
from app.core.redis import get_redis
from app.core.cache import cache_invalidate_pattern, make_key
from app.api.auth_deps import get_current_user
from app.schemas.request import AppKeywordUpdateRequest
from app.db.repositories.ranking_repository import RankingRepository
from app.core.logging_route import LoggingRoute

logger = get_logger(__name__)

router = APIRouter(
    prefix="/keywords",
    tags=["Keywords"],
    route_class=LoggingRoute,
)


@router.post("/apps/{app_id}/keywords")
async def add_keywords_to_app(
    app_id: int,
    request: AppKeywordUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    redis: aioredis.Redis | None = Depends(get_redis),
):
    """
    Add one or more keywords to an existing app.

    Args:
        app_id: App ID.
        request: Keywords payload.
        db: Database session.
        current_user: Authenticated user.

    Returns:
        App object with updated keywords.
    """
    try:
        app = RankingRepository.get_app_by_id(db, app_id, user_id=current_user.id)
        if not app:
            raise HTTPException(status_code=404, detail="App not found")

        existing_keywords_map = {k.name.strip().lower(): k.name for k in app.keywords}
        added_keywords = []
        duplicate_keywords = []
        seen_in_request = set()

        for raw_keyword_name in request.keywords:
            keyword_name = raw_keyword_name.strip()
            if not keyword_name:
                continue

            kw_lower = keyword_name.lower()
            if kw_lower in existing_keywords_map:
                existing_name = existing_keywords_map[kw_lower]
                if existing_name not in duplicate_keywords:
                    duplicate_keywords.append(existing_name)
            elif kw_lower in seen_in_request:
                if keyword_name not in duplicate_keywords:
                    duplicate_keywords.append(keyword_name)
            else:
                seen_in_request.add(kw_lower)
                keyword = RankingRepository.get_or_create_keyword(db, keyword_name)
                RankingRepository.add_keyword_to_app(db, app, keyword)
                added_keywords.append({"id": keyword.id, "name": keyword.name})

        await cache_invalidate_pattern(redis, make_key(f"user:{current_user.id}", "rankings", "*"))
        await cache_invalidate_pattern(redis, make_key(f"user:{current_user.id}", "apps", "*"))

        db.refresh(app)

        if duplicate_keywords and not added_keywords:
            if len(duplicate_keywords) == 1:
                message = f"Keyword '{duplicate_keywords[0]}' is already in the list."
            else:
                dup_str = ", ".join([f"'{k}'" for k in duplicate_keywords])
                message = f"Keywords {dup_str} are already in the list."
        elif duplicate_keywords and added_keywords:
            dup_str = ", ".join([f"'{k}'" for k in duplicate_keywords])
            message = f"Added {len(added_keywords)} keyword(s). {dup_str} already in the list."
        else:
            message = f"Successfully added {len(added_keywords)} keyword(s)."

        return {
            "message": message,
            "app": {"id": app.id, "name": app.name, "url": app.url},
            "keywords": [{"id": k.id, "name": k.name} for k in app.keywords],
            "added": added_keywords,
            "duplicates": duplicate_keywords,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Failed to add keywords to app_id={app_id} for user={current_user.email}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to add keywords to app")


@router.delete("/apps/{app_id}/keywords/{keyword_id}")
async def remove_keyword_from_app(
    app_id: int,
    keyword_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    redis: aioredis.Redis | None = Depends(get_redis),
):
    """
    Remove a keyword association from an existing app.

    Args:
        app_id: App ID.
        keyword_id: Keyword ID.
        db: Database session.
        current_user: Authenticated user.

    Returns:
        Confirmation message.
    """
    try:
        app = RankingRepository.get_app_by_id(db, app_id, user_id=current_user.id)
        if not app:
            raise HTTPException(status_code=404, detail="App not found")

        keyword = RankingRepository.get_keyword_by_id(db, keyword_id)
        if not keyword:
            raise HTTPException(status_code=404, detail="Keyword not found")

        RankingRepository.remove_keyword_from_app(db, app, keyword)

        await cache_invalidate_pattern(redis, make_key(f"user:{current_user.id}", "rankings", "*"))
        await cache_invalidate_pattern(redis, make_key(f"user:{current_user.id}", "apps", "*"))

        return {
            "message": "Keyword removed from app",
            "app": {"id": app.id, "name": app.name, "url": app.url},
            "keyword": {"id": keyword.id, "name": keyword.name},
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Failed to remove keyword_id={keyword_id} from app_id={app_id} for user={current_user.email}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to remove keyword from app")



