from datetime import datetime
from sqlalchemy.orm import Session
from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.logger import get_logger
from app.db import get_db, init_db
from app.schemas.request import TrackerRequest, AppKeywordUpdateRequest, AppRequest
from app.services.tracker_service import TrackerService
from app.db.repositories.ranking_repository import RankingRepository

logger = get_logger(__name__)


def _build_saved_apps_payload(db) -> list[AppRequest]:
    apps = RankingRepository.get_all_apps(db)
    payload = []
    for app in apps:
        keywords = [keyword.name for keyword in app.keywords]
        if keywords:
            payload.append(AppRequest(name=app.name, url=app.url, keywords=keywords))
    return payload

router = APIRouter(prefix="/tracker", tags=["Tracker"])


@router.on_event("startup")
def startup():
    """Initialize database on startup."""
    init_db()


@router.post("/run")
def run_tracker(request: TrackerRequest, db: Session = Depends(get_db)):
    """
    Execute the rank tracker for the provided apps and keywords.

    Args:
        request: TrackerRequest containing list of apps to track.
        db: Database session.

    Returns:
        Dictionary with tracking results.
    """
    try:
        service = TrackerService(db=db)

        results = service.run(request.apps)

        return {
            "message": "Tracking completed",
            "results": results
        }
    except Exception as e:
        logger.exception("Failed to run tracker: %s", str(e))
        raise HTTPException(status_code=500, detail=f"Failed to run tracker")


@router.get("/history/{app_id}/{keyword_id}")
def get_ranking_history(
    app_id: int,
    keyword_id: int,
    days: int = 30,
    db: Session = Depends(get_db),
):
    """
    Get ranking history for a specific app and keyword.

    Args:
        app_id: App ID.
        keyword_id: Keyword ID.
        days: Number of days to look back (default: 30).
        db: Database session.

    Returns:
        List of ranking records with app and keyword details.
    """
    try:
        app = RankingRepository.get_app_by_id(db, app_id)
        if not app:
            raise HTTPException(status_code=404, detail="App not found")

        keyword = RankingRepository.get_keyword_by_id(db, keyword_id)
        if not keyword:
            raise HTTPException(status_code=404, detail="Keyword not found")

        rankings = RankingRepository.get_ranking_history(db, app_id, keyword_id, days)
        windows = {
            "7_days": 7,
            "30_days": 30,
            "3_months": 90,
            "6_months": 180,
            "12_months": 365,
        }
        averages = RankingRepository.get_average_rank_windows(db, app_id, keyword_id, windows)

        return {
            "app": {"id": app.id, "name": app.name, "url": app.url},
            "keyword": {"id": keyword.id, "name": keyword.name},
            "history": [
                {
                    "id": r.id,
                    "rank": r.rank,
                    "page": r.page,
                    "found": r.found,
                    "screenshot_path": r.screenshot_path,
                    "tracked_date": r.tracked_date.isoformat(),
                }
                for r in rankings
            ],
            "averages": averages,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"""Failed to retrieve ranking history for app_id={app_id}, "keyword_id={keyword_id}, days={days}: {str(e)}""")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve history")


@router.get("/history/{app_id}")
def get_ranking_history_multi(
    app_id: int,
    keyword_ids: list[int] | None = Query(None),
    days: int = 30,
    db: Session = Depends(get_db),
):
    """
    Get ranking history for one or more keywords for a given app.

    Args:
        app_id: App ID.
        keyword_ids: Optional list of keyword IDs to include.
        days: Number of days to look back (default: 30).
        db: Database session.

    Returns:
        Ranking history grouped by keyword.
    """
    try:
        app = RankingRepository.get_app_by_id(db, app_id)
        if not app:
            raise HTTPException(status_code=404, detail="App not found")

        if keyword_ids:
            keywords = [k for k in app.keywords if k.id in keyword_ids]
            if not keywords:
                raise HTTPException(status_code=404, detail="Keyword(s) not found for this app")
        else:
            keywords = app.keywords

        windows = {
            "7_days": 7,
            "30_days": 30,
            "3_months": 90,
            "6_months": 180,
            "12_months": 365,
        }

        results = []
        for keyword in keywords:
            rankings = RankingRepository.get_ranking_history(db, app_id, keyword.id, days)
            averages = RankingRepository.get_average_rank_windows(db, app_id, keyword.id, windows)
            results.append(
                {
                    "keyword": {"id": keyword.id, "name": keyword.name},
                    "history": [
                        {
                            "id": r.id,
                            "rank": r.rank,
                            "page": r.page,
                            "found": r.found,
                            "screenshot_path": r.screenshot_path,
                            "tracked_date": r.tracked_date.isoformat(),
                        }
                        for r in rankings
                    ],
                    "averages": averages,
                }
            )

        return {
            "app": {"id": app.id, "name": app.name, "url": app.url},
            "keywords": results,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Failed to retrieve ranking history for app_id={app_id}, keyword_ids={keyword_ids}, days={days}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve history")


@router.get("/latest")
def get_latest_rankings(app_id: int = None, db: Session = Depends(get_db)):
    """
    Get the latest ranking for each app-keyword combination (today).

    Args:
        app_id: Optional app ID to filter by.
        db: Database session.

    Returns:
        List of latest ranking records with app and keyword details.
    """
    try:
        rankings = RankingRepository.get_latest_rankings(db, app_id)

        results = []
        for ranking in rankings:
            results.append(
                {
                    "id": ranking.id,
                    "app": {
                        "id": ranking.app.id,
                        "name": ranking.app.name,
                        "url": ranking.app.url,
                    },
                    "keyword": {
                        "id": ranking.keyword.id,
                        "name": ranking.keyword.name,
                    },
                    "rank": ranking.rank,
                    "page": ranking.page,
                    "found": ranking.found,
                    "screenshot_path": ranking.screenshot_path,
                    "tracked_date": ranking.tracked_date.isoformat(),
                }
            )

        return {"results": results}

    except Exception as e:
        logger.exception(f"Failed to retrieve latest rankings for app_id={app_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve latest rankings")


@router.get("/apps")
def get_all_apps(db: Session = Depends(get_db)):
    """
    Get all tracked apps.

    Args:
        db: Database session.

    Returns:
        List of all apps with their tracking history count.
    """
    try:
        apps = RankingRepository.get_all_apps(db)

        return {
            "apps": [
                {
                    "id": app.id,
                    "name": app.name,
                    "url": app.url,
                    "created_at": app.created_at.isoformat(),
                    "history_count": len(app.rankings),
                    "keywords": [{"id": k.id, "name": k.name} for k in app.keywords],
                }
                for app in apps
            ]
        }

    except Exception as e:
        logger.exception(f"Failed to retrieve apps: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve apps")


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


@router.post("/run/saved")
def run_saved_apps(db: Session = Depends(get_db)):
    """
    Run tracker for all saved apps and their keywords from the database.

    This endpoint is suitable for scheduled execution via Vercel Cron or another scheduler.

    Returns:
        Dictionary with tracking results.
    """
    try:
        apps_payload = _build_saved_apps_payload(db)
        if not apps_payload:
            return {
                "message": "No saved apps with keywords found.",
                "results": [],
            }

        service = TrackerService(db=db)
        results = service.run(apps_payload)

        return {
            "message": "Saved apps tracking completed.",
            "results": results,
        }
    except Exception as e:
        logger.exception("Failed to run saved apps tracker: %s", str(e))
        raise HTTPException(status_code=500, detail="Failed to run saved apps tracker")

