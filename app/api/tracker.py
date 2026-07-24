from sqlalchemy.orm import Session
from fastapi import APIRouter, Depends, HTTPException

from app.db import get_db, init_db
from app.db.models.user import User
from app.core.logger import get_logger
from app.api.auth_deps import get_current_user
from app.services.tracker_service import TrackerService
from app.schemas.request import TrackerRequest, AppRequest
from app.db.repositories.ranking_repository import RankingRepository

logger = get_logger(__name__)


def _build_saved_apps_payload(db, user_id: int) -> list[AppRequest]:
    apps = RankingRepository.get_all_apps(db, user_id=user_id)
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
def run_tracker(
    request: TrackerRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Execute the rank tracker for the provided apps and keywords.

    Args:
        request: TrackerRequest containing list of apps to track.
        db: Database session.
        current_user: Authenticated user.

    Returns:
        Dictionary with tracking results.
    """
    try:
        service = TrackerService(db=db, user_id=current_user.id)

        results = service.run(request.apps)

        return {
            "message": "Tracking completed",
            "results": results
        }
    except Exception as e:
        logger.exception("Failed to run tracker for user=%s: %s", current_user.email, str(e))
        raise HTTPException(status_code=500, detail=f"Failed to run tracker")


@router.post("/run/saved")
def run_saved_apps(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Run tracker for all saved apps and their keywords from the database for the current user.

    Returns:
        Dictionary with tracking results.
    """
    try:
        apps_payload = _build_saved_apps_payload(db, current_user.id)
        if not apps_payload:
            return {
                "message": "No saved apps with keywords found.",
                "results": [],
            }

        service = TrackerService(db=db, user_id=current_user.id)
        results = service.run(apps_payload)

        return {
            "message": "Saved apps tracking completed.",
            "results": results,
        }
    except Exception as e:
        logger.exception("Failed to run saved apps tracker for user=%s: %s", current_user.email, str(e))
        raise HTTPException(status_code=500, detail="Failed to run saved apps tracker")


@router.get("/apps/last-sync")
def get_apps_last_sync(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Retrieve the last synchronization details for all tracked applications of the current user.

    Args:
        db (Session): Database session.
        current_user (User): Authenticated user.

    Returns:
        dict: A response containing a list of application sync details.

    Raises:
        HTTPException: If the application sync details cannot be retrieved.
    """
    try:
        apps = RankingRepository.get_apps_last_sync(db, user_id=current_user.id)

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
        logger.exception(f"Failed to retrieve app last sync details for user={current_user.email}: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Failed to retrieve app last sync details"
        )


@router.post("/run/cron")
def run_cron_saved_apps(db: Session = Depends(get_db)):
    """
    Execute the scheduled ranking tracker for all saved applications.

    This endpoint is intended for automated cron jobs. It retrieves all
    tracked applications from the database, groups them by user, and
    processes each user's applications independently. Ranking results
    are generated and stored for every application and keyword before a
    consolidated response is returned.

    Raises:
        HTTPException:
            - 500: If an unexpected error occurs while executing the
              scheduled tracking process.
    """
    try:
        from app.db.models.ranking import App
        all_apps = db.query(App).filter(App.is_deleted == False, App.is_competitor == False).all()
        if not all_apps:
            return {"message": "No saved apps found to track.", "results": []}

        from collections import defaultdict
        user_apps = defaultdict(list)
        for app in all_apps:
            if app.user_id:
                user_apps[app.user_id].append(app)

        all_results = []

        for user_id, apps in user_apps.items():
            apps_payload = []
            for app in apps:
                keywords = [k.name for k in app.keywords]
                if keywords:
                    apps_payload.append(
                        AppRequest(name=app.name, url=app.url, keywords=keywords)
                    )

            if apps_payload:
                logger.info(f"Running cron tracking for user_id={user_id} with {len(apps_payload)} apps")
                service = TrackerService(db=db, user_id=user_id)
                results = service.run(apps_payload)
                all_results.extend(results)

        return {
            "message": "Global cron tracking run completed successfully.",
            "results": all_results,
        }
    except Exception as e:
        logger.exception(f"Failed to run global cron tracking: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Failed to run global cron tracking"
        )

