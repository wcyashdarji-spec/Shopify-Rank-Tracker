from typing import List, Optional
from sqlalchemy import func
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from app.core.logger import get_logger
from app.db.models.ranking import App, Keyword, RankingHistory

logger = get_logger(__name__)


class RankingRepository:
    """Repository for managing ranking data in the database."""

    @staticmethod
    def get_or_create_app(db: Session, name: str, url: str) -> App:
        """
        Get existing app or create a new one.

        Args:
            db: Database session.
            name: App name.
            url: App URL.

        Returns:
            App object.
        """
        try:
            app = db.query(App).filter(App.url == url).first()
            if app:
                return app

            app = App(name=name, url=url)
            db.add(app)
            db.commit()
            db.refresh(app)

            logger.info("Created new app: %s", name)
            return app

        except Exception as e:
            db.rollback()
            logger.exception(f"Failed to get or create app: {name} with URL: {url} {str(e)}")
            raise

    @staticmethod
    def get_or_create_keyword(db: Session, name: str) -> Keyword:
        """
        Get existing keyword or create a new one.

        Args:
            db: Database session.
            name: Keyword name.

        Returns:
            Keyword object.
        """
        try:
            keyword = db.query(Keyword).filter(Keyword.name == name).first()
            if keyword:
                return keyword

            keyword = Keyword(name=name)
            db.add(keyword)
            db.commit()
            db.refresh(keyword)

            logger.info("Created new keyword: %s", name)
            return keyword

        except Exception as e:
            db.rollback()
            logger.exception(f"Failed to get or create keyword: {name} {str(e)}")
            raise

    @staticmethod
    def save_ranking(
        db: Session,
        app_id: int,
        keyword_id: int,
        rank: Optional[int],
        page: Optional[int],
        found: bool,
        screenshot_path: Optional[str] = None,
    ) -> RankingHistory:
        """
        Save a ranking record to the database.

        Args:
            db: Database session.
            app_id: App ID.
            keyword_id: Keyword ID.
            rank: Rank position.
            page: Page number.
            found: Whether app was found.
            screenshot_path: Path to screenshot.

        Returns:
            RankingHistory object.
        """
        try:
            ranking = RankingHistory(
                app_id=app_id,
                keyword_id=keyword_id,
                rank=rank,
                page=page,
                found=found,
                screenshot_path=screenshot_path,
            )
            db.add(ranking)
            db.commit()
            db.refresh(ranking)

            logger.info(
                "Saved ranking: app_id=%s, keyword_id=%s, rank=%s",
                app_id,
                keyword_id,
                rank,
            )
            return ranking

        except Exception as e:
            db.rollback()
            logger.exception(f"Failed to save ranking: {str(e)}")
            raise

    @staticmethod
    def get_ranking_history(
        db: Session,
        app_id: int,
        keyword_id: int,
        days: int = 30,
    ) -> List[RankingHistory]:
        """
        Get ranking history for an app and keyword.

        Args:
            db: Database session.
            app_id: App ID.
            keyword_id: Keyword ID.
            days: Number of days to look back.

        Returns:
            List of RankingHistory objects.
        """
        try:
            since = datetime.utcnow() - timedelta(days=days)

            rankings = (
                db.query(RankingHistory)
                .filter(
                    RankingHistory.app_id == app_id,
                    RankingHistory.keyword_id == keyword_id,
                    RankingHistory.tracked_date >= since,
                )
                .order_by(RankingHistory.tracked_date.asc())
                .all()
            )

            return rankings

        except Exception as e:
            logger.exception(f"Failed to retrieve ranking history: {str(e)}")
            raise

    @staticmethod
    def get_average_rank_windows(
        db: Session,
        app_id: int,
        keyword_id: int,
        windows: dict[str, int],
    ) -> dict[str, dict[str, Optional[float]]]:
        """
        Compute average rank metrics for defined time windows.

        Args:
            db: Database session.
            app_id: App ID.
            keyword_id: Keyword ID.
            windows: Mapping of label to lookback days.

        Returns:
            Dictionary of average rank and record count for each window.
        """
        try:
            averages = {}
            for label, days in windows.items():
                since = datetime.utcnow() - timedelta(days=days)
                avg_rank, record_count = (
                    db.query(
                        func.avg(RankingHistory.rank),
                        func.count(RankingHistory.rank),
                    )
                    .filter(
                        RankingHistory.app_id == app_id,
                        RankingHistory.keyword_id == keyword_id,
                        RankingHistory.tracked_date >= since,
                        RankingHistory.rank != None,
                    )
                    .one()
                )

                averages[label] = {
                    "average_rank": round(avg_rank, 2) if avg_rank is not None else None,
                    "record_count": record_count,
                }

            return averages

        except Exception as e:
            logger.exception(
                f"Failed to compute averages for app_id={app_id}, keyword_id={keyword_id}: {str(e)}"
            )
            raise

    @staticmethod
    def get_app_by_id(db: Session, app_id: int) -> Optional[App]:
        """
        Get app by ID.

        Args:
            db: Database session.
            app_id: App ID.

        Returns:
            App object or None.
        """
        try:
            return db.query(App).filter(App.id == app_id).first()
        except Exception as e:
            logger.exception(f"Failed to get app by ID: {app_id} {str(e)}")
            raise

    @staticmethod
    def get_keyword_by_id(db: Session, keyword_id: int) -> Optional[Keyword]:
        """
        Get keyword by ID.

        Args:
            db: Database session.
            keyword_id: Keyword ID.

        Returns:
            Keyword object or None.
        """
        try:
            return db.query(Keyword).filter(Keyword.id == keyword_id).first()
        except Exception as e:
            logger.exception(f"Failed to get keyword by ID: {keyword_id} {str(e)}")
            raise

    @staticmethod
    def add_keyword_to_app(db: Session, app: App, keyword: Keyword) -> None:
        """
        Associate a `Keyword` with an `App` (many-to-many).

        Args:
            db: Database session.
            app: App instance.
            keyword: Keyword instance.
        """
        try:
            db.refresh(app)
            if keyword not in app.keywords:
                app.keywords.append(keyword)
                db.add(app)
                db.commit()
                db.refresh(app)
                logger.info("Associated keyword '%s' with app '%s'", keyword.name, app.name)
        except Exception as e:
            db.rollback()
            logger.exception(f"Failed to associate keyword '{getattr(keyword, 'name', None)}' with app '{getattr(app, 'name', None)}': {str(e)}")
            raise

    @staticmethod
    def remove_keyword_from_app(db: Session, app: App, keyword: Keyword) -> None:
        """
        Remove the association between an `App` and a `Keyword`.

        Args:
            db: Database session.
            app: App instance.
            keyword: Keyword instance.
        """
        try:
            db.refresh(app)
            if keyword in app.keywords:
                app.keywords.remove(keyword)
                db.add(app)
                db.commit()
                db.refresh(app)
                logger.info("Removed keyword '%s' from app '%s'", keyword.name, app.name)
        except Exception as e:
            db.rollback()
            logger.exception(f"Failed to remove keyword '{getattr(keyword, 'name', None)}' from app '{getattr(app, 'name', None)}': {str(e)}")
            raise

    @staticmethod
    def get_all_apps(db: Session) -> List[App]:
        """
        Get all apps from database.

        Args:
            db: Database session.

        Returns:
            List of App objects.
        """
        try:
            return db.query(App).all()
        except Exception as e:
            logger.exception(f"Failed to retrieve all apps: {str(e)}")
            raise

    @staticmethod
    def get_latest_rankings(
        db: Session,
        app_id: Optional[int] = None,
    ) -> List[RankingHistory]:
        """
        Get the latest ranking for each app-keyword combination (today).

        Args:
            db: Database session.
            app_id: Optional app ID to filter by.

        Returns:
            List of latest RankingHistory objects.
        """
        try:
            today = datetime.utcnow().date()
            query = db.query(RankingHistory).filter(
                RankingHistory.tracked_date >= datetime(today.year, today.month, today.day)
            )

            if app_id:
                query = query.filter(RankingHistory.app_id == app_id)

            return query.order_by(RankingHistory.tracked_date.desc()).all()

        except Exception as e:
            logger.exception(f"Failed to retrieve latest rankings: {str(e)}")
            raise

