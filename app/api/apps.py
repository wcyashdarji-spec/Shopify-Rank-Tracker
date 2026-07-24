from sqlalchemy.orm import Session
from fastapi import APIRouter, Depends, HTTPException

from app.db import get_db
from app.db.models.user import User
from app.core.logger import get_logger
from app.api.auth_deps import get_current_user
from app.schemas.request import CompetitorCreateRequest
from app.db.repositories.ranking_repository import RankingRepository

logger = get_logger(__name__)

router = APIRouter(
    prefix="/apps",
    tags=["Apps"],
)


@router.get("/apps")
def get_all_apps(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get all tracked apps for the authenticated user.

    Args:
        db: Database session.
        current_user: Authenticated user.

    Returns:
        List of all user's apps with their tracking history count.
    """
    try:
        apps = RankingRepository.get_all_apps(db, user_id=current_user.id)

        return {
            "apps": [
                {
                    "id": app.id,
                    "user_id": app.user_id,
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
        logger.exception(f"Failed to retrieve apps for user={current_user.email}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve apps")


@router.delete("/apps/{app_id}")
def delete_app(
    app_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Delete an application and all of its associated rankings and keyword mappings if owned by the user.

    Args:
        app_id: App ID.
        db: Database session.
        current_user: Authenticated user.

    Returns:
        Confirmation message.
    """
    try:
        app = RankingRepository.get_app_by_id(db, app_id, user_id=current_user.id)
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
        logger.exception(f"Failed to delete app_id={app_id} for user={current_user.email}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to delete application")


@router.get("/{app_id}/competitors")
def get_competitors(
    app_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Retrieve all competitors associated with a primary application.

    This endpoint verifies that the requested application belongs to the
    authenticated user and returns the list of linked competitor apps.
    Each competitor includes its basic information along with the total
    number of ranking history records available.

    Raises:
        HTTPException:
            - 404: If the requested application does not exist.
            - 500: If an unexpected error occurs while retrieving competitors.
    """
    try:
        app = RankingRepository.get_app_by_id(db, app_id, user_id=current_user.id)
        if not app:
            raise HTTPException(status_code=404, detail="App not found")

        return {
            "competitors": [
                {
                    "id": c.id,
                    "name": c.name,
                    "url": c.url,
                    "created_at": c.created_at.isoformat(),
                    "history_count": len(c.rankings),
                }
                for c in app.competitors
            ]
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Failed to get competitors for app_id={app_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve competitors")


@router.post("/{app_id}/competitors")
def add_competitor(
    app_id: int,
    request: CompetitorCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Add a competitor application to a primary application.

    This endpoint validates ownership of the primary application,
    creates or associates the specified competitor, and links it to
    the selected application. The response includes the newly added
    competitor's basic information.

    Raises:
        HTTPException:
            - 404: If the requested application does not exist.
            - 500: If an unexpected error occurs while adding the competitor.
    """
    try:
        app = RankingRepository.get_app_by_id(db, app_id, user_id=current_user.id)
        if not app:
            raise HTTPException(status_code=404, detail="App not found")

        competitor = RankingRepository.add_competitor_to_app(db, app, request.name, str(request.url))

        return {
            "message": "Competitor added successfully",
            "competitor": {
                "id": competitor.id,
                "name": competitor.name,
                "url": competitor.url,
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Failed to add competitor to app_id={app_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to add competitor")


@router.delete("/{app_id}/competitors/{competitor_id}")
def delete_competitor(
    app_id: int,
    competitor_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Remove a competitor from a primary application.

    This endpoint verifies ownership of both the primary application
    and the competitor, removes the association between them, and
    returns a confirmation message upon successful deletion.

    Raises:
        HTTPException:
            - 404: If the application or competitor cannot be found.
            - 500: If an unexpected error occurs while removing the competitor.
    """
    try:
        app = RankingRepository.get_app_by_id(db, app_id, user_id=current_user.id)
        if not app:
            raise HTTPException(status_code=404, detail="App not found")

        competitor = db.query(User.apps.mapper.class_).filter(
            User.apps.mapper.class_.id == competitor_id,
            User.apps.mapper.class_.user_id == current_user.id,
            User.apps.mapper.class_.is_competitor == True
        ).first()
        
        if not competitor:

            from app.db.models.ranking import App as AppModel
            competitor = db.query(AppModel).filter(
                AppModel.id == competitor_id,
                AppModel.user_id == current_user.id,
                AppModel.is_competitor == True
            ).first()

        if not competitor:
            raise HTTPException(status_code=404, detail="Competitor not found")

        RankingRepository.remove_competitor_from_app(db, app, competitor)

        return {
            "message": "Competitor removed successfully",
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Failed to delete competitor_id={competitor_id} from app_id={app_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to remove competitor")



    

