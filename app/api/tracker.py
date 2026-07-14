from sqlalchemy.orm import Session
from fastapi import APIRouter, Depends, HTTPException

from app.db import get_db, init_db
from app.core.logger import get_logger
from app.schemas.request import TrackerRequest, AppRequest
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


@router.get("/apps/last-sync")
def get_apps_last_sync(db: Session = Depends(get_db)):
    """
    Retrieve the last synchronization details for all tracked applications.

    Returns a list of applications, including their ID, name, URL, and the
    timestamp of their most recent synchronization.

    Args:
        db (Session): Database session.

    Returns:
        dict: A response containing a list of application sync details.

    Raises:
        HTTPException: If the application sync details cannot be retrieved.
    """
    try:
        apps = RankingRepository.get_apps_last_sync(db)

        return {
            "apps": [
                {
                    "id": app.id,
                    "name": app.name,
                    "url": app.url,
                    "last_synced_at": (
                        app.last_synced_at.isoformat()
                        if app.last_synced_at
                        else None
                    ),
                }
                for app in apps
            ]
        }

    except Exception as e:
        logger.exception(f"Failed to retrieve app last sync details: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Failed to retrieve app last sync details"
        )
    
