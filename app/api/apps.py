from sqlalchemy.orm import Session
from fastapi import APIRouter, Depends, HTTPException

from app.db import get_db
from app.core.logger import get_logger
from app.db.repositories.ranking_repository import RankingRepository

logger = get_logger(__name__)

router = APIRouter(
    prefix="/apps",
    tags=["Apps"],
)


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


@router.delete("/apps/{app_id}")
def delete_app(
    app_id: int,
    db: Session = Depends(get_db),
):
    """
    Delete an application and all of its associated rankings and keyword mappings.

    Args:
        app_id: App ID.
        db: Database session.

    Returns:
        Confirmation message.
    """
    try:
        app = RankingRepository.get_app_by_id(db, app_id)
        if not app:
            raise HTTPException(status_code=404, detail="App not found")

        RankingRepository.delete_app(db, app)

        return {
            "message": "Application deleted successfully",
            "app": {
                "id": app.id,
                "name": app.name,
            },
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Failed to delete app_id={app_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to delete application")
    

