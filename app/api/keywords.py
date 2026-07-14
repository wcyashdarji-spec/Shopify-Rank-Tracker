from sqlalchemy.orm import Session
from fastapi import APIRouter, Depends, HTTPException

from app.db import get_db
from app.core.logger import get_logger
from app.schemas.request import AppKeywordUpdateRequest
from app.db.repositories.ranking_repository import RankingRepository

logger = get_logger(__name__)

router = APIRouter(
    prefix="/keywords",
    tags=["Keywords"],
)


@router.post("/apps/{app_id}/keywords")
def add_keywords_to_app(
    app_id: int,
    request: AppKeywordUpdateRequest,
    db: Session = Depends(get_db),
):
    """
    Add one or more keywords to an existing app.

    Args:
        app_id: App ID.
        request: Keywords payload.
        db: Database session.

    Returns:
        App object with updated keywords.
    """
    try:
        app = RankingRepository.get_app_by_id(db, app_id)
        if not app:
            raise HTTPException(status_code=404, detail="App not found")

        added_keywords = []
        for keyword_name in request.keywords:
            keyword_name = keyword_name.strip()
            if not keyword_name:
                continue

            keyword = RankingRepository.get_or_create_keyword(db, keyword_name)
            RankingRepository.add_keyword_to_app(db, app, keyword)
            added_keywords.append({"id": keyword.id, "name": keyword.name})

        return {
            "app": {"id": app.id, "name": app.name, "url": app.url},
            "keywords": [{"id": k.id, "name": k.name} for k in app.keywords],
            "added": added_keywords,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Failed to add keywords to app_id={app_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to add keywords to app")


@router.delete("/apps/{app_id}/keywords/{keyword_id}")
def remove_keyword_from_app(
    app_id: int,
    keyword_id: int,
    db: Session = Depends(get_db),
):
    """
    Remove a keyword association from an existing app.

    Args:
        app_id: App ID.
        keyword_id: Keyword ID.
        db: Database session.

    Returns:
        Confirmation message.
    """
    try:
        app = RankingRepository.get_app_by_id(db, app_id)
        if not app:
            raise HTTPException(status_code=404, detail="App not found")

        keyword = RankingRepository.get_keyword_by_id(db, keyword_id)
        if not keyword:
            raise HTTPException(status_code=404, detail="Keyword not found")

        RankingRepository.remove_keyword_from_app(db, app, keyword)

        return {
            "message": "Keyword removed from app",
            "app": {"id": app.id, "name": app.name, "url": app.url},
            "keyword": {"id": keyword.id, "name": keyword.name},
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Failed to remove keyword_id={keyword_id} from app_id={app_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to remove keyword from app")



