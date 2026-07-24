from sqlalchemy.orm import Session
from fastapi import APIRouter, Depends, HTTPException, Query

from app.db import get_db
from app.core.logger import get_logger
from app.db.repositories.ranking_repository import RankingRepository
from app.db.models.user import User
from app.api.auth_deps import get_current_user

logger = get_logger(__name__)

router = APIRouter(
    prefix="/tracker",
    tags=["Rankings"],
)

@router.get("/latest")
def get_latest_rankings(
    app_id: int = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get the latest ranking for each app-keyword combination (today) for the authenticated user.

    Args:
        app_id: Optional app ID to filter by.
        db: Database session.
        current_user: Authenticated user.

    Returns:
        List of latest ranking records with app and keyword details.
    """
    try:
        rankings = RankingRepository.get_latest_rankings(db, app_id, user_id=current_user.id)

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
        logger.exception(f"Failed to retrieve latest rankings for app_id={app_id} for user={current_user.email}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve latest rankings")


@router.get("/history/{app_id}")
def get_ranking_history_multi(
    app_id: int,
    keyword_ids: list[int] | None = Query(None),
    days: int = 30,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get ranking history for one or more keywords for a given app, including competitor history.

    Args:
        app_id: App ID.
        keyword_ids: Optional list of keyword IDs to include.
        days: Number of days to look back (default: 30).
        db: Database session.
        current_user: Authenticated user.

    Returns:
        Ranking history grouped by keyword with competitor metrics.
    """
    try:
        app = RankingRepository.get_app_by_id(db, app_id, user_id=current_user.id)
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
            
            competitors_data = []
            for comp in app.competitors:
                comp_rankings = RankingRepository.get_ranking_history(db, comp.id, keyword.id, days)
                comp_averages = RankingRepository.get_average_rank_windows(db, comp.id, keyword.id, windows)
                competitors_data.append({
                    "id": comp.id,
                    "name": comp.name,
                    "url": comp.url,
                    "history": [
                        {
                            "id": r.id,
                            "rank": r.rank,
                            "page": r.page,
                            "found": r.found,
                            "tracked_date": r.tracked_date.isoformat(),
                        }
                        for r in comp_rankings
                    ],
                    "averages": comp_averages,
                })

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
                    "competitors": competitors_data,
                }
            )

        return {
            "app": {"id": app.id, "name": app.name, "url": app.url},
            "keywords": results,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Failed to retrieve ranking history for app_id={app_id}, keyword_ids={keyword_ids}, days={days} for user={current_user.email}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve history")


@router.get("/history/{app_id}/{keyword_id}")
def get_ranking_history(
    app_id: int,
    keyword_id: int,
    days: int = 30,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get ranking history for a specific app and keyword.

    Args:
        app_id: App ID.
        keyword_id: Keyword ID.
        days: Number of days to look back (default: 30).
        db: Database session.
        current_user: Authenticated user.

    Returns:
        List of ranking records with app and keyword details.
    """
    try:
        app = RankingRepository.get_app_by_id(db, app_id, user_id=current_user.id)
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
        logger.exception(f"Failed to retrieve ranking history for app_id={app_id}, keyword_id={keyword_id}, days={days} for user={current_user.email}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve history")


