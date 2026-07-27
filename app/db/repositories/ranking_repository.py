from typing import List, Optional
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.db.models.user import User
from app.core.logger import get_logger
from datetime import datetime, timedelta
from app.db.models.ranking import App, Keyword, RankingHistory, AppInvitation

logger = get_logger(__name__)


class RankingRepository:
    """Repository for managing ranking data in the database."""

    @staticmethod
    def get_or_create_app(db: Session, name: str, url: str, user_id: Optional[int] = None) -> App:
        """
        Get existing app or create a new one.

        Args:
            db: Database session.
            name: App name.
            url: App URL.
            user_id: User ID.

        Returns:
            App object.
        """
        try:
            query = db.query(App).filter(App.url == url)
            if user_id is not None:
                query = query.filter(App.user_id == user_id)
            app = query.first()
            if app:
                if app.is_deleted:
                    app.is_deleted = False
                    db.commit()
                    db.refresh(app)
                    logger.info("Restored soft-deleted app: %s for user: %s", name, user_id)
                return app

            app = App(name=name, url=url, user_id=user_id)
            db.add(app)
            db.commit()
            db.refresh(app)

            logger.info("Created new app: %s for user: %s", name, user_id)
            return app

        except Exception as e:
            db.rollback()
            logger.exception(f"Failed to get or create app: {name} with URL: {url} for user: {user_id} {str(e)}")
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
    def get_app_by_id(
        db: Session,
        app_id: int,
        user_id: Optional[int] = None,
        include_deleted: bool = False,
    ) -> Optional[App]:
        """
        Get app by ID.

        Args:
            db: Database session.
            app_id: App ID.
            user_id: User ID.
            include_deleted: Whether to include soft-deleted apps.

        Returns:
            App object or None.
        """
        try:
            query = db.query(App).filter(App.id == app_id)
            if not include_deleted:
                query = query.filter(App.is_deleted == False)
            if user_id is not None:
                query = query.filter(
                    (App.user_id == user_id) |
                    (App.collaborators.any(id=user_id))
                )
            return query.first()
        except Exception as e:
            logger.exception(f"Failed to get app by ID: {app_id} for user: {user_id} {str(e)}")
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
    def get_all_apps(
        db: Session,
        user_id: Optional[int] = None,
        include_deleted: bool = False,
    ) -> List[App]:
        """
        Get all primary apps from database.

        Args:
            db: Database session.
            user_id: Optional User ID to filter by.
            include_deleted: Whether to include soft-deleted apps.

        Returns:
            List of App objects.
        """
        try:
            query = db.query(App).filter(App.is_competitor == False)
            if not include_deleted:
                query = query.filter(App.is_deleted == False)
            if user_id is not None:
                query = query.filter(
                    (App.user_id == user_id) |
                    (App.collaborators.any(id=user_id))
                )
            return query.all()
        except Exception as e:
            logger.exception(f"Failed to retrieve all apps: {str(e)}")
            raise

    @staticmethod
    def get_latest_rankings(
        db: Session,
        app_id: Optional[int] = None,
        user_id: Optional[int] = None,
    ) -> List[RankingHistory]:
        """
        Get the latest ranking for each app-keyword combination (today).

        Args:
            db: Database session.
            app_id: Optional app ID to filter by.
            user_id: Optional user ID to filter by.

        Returns:
            List of latest RankingHistory objects.
        """
        try:
            today = datetime.utcnow().date()
            query = db.query(RankingHistory).join(App).filter(
                RankingHistory.tracked_date >= datetime(today.year, today.month, today.day),
                App.is_deleted == False
            )

            if app_id:
                query = query.filter(RankingHistory.app_id == app_id)

            if user_id is not None:
                query = query.filter(
                    (App.user_id == user_id) |
                    (App.collaborators.any(id=user_id))
                )

            return query.order_by(RankingHistory.tracked_date.desc()).all()

        except Exception as e:
            logger.exception(f"Failed to retrieve latest rankings: {str(e)}")
            raise

    @staticmethod
    def delete_app(db: Session, app: App) -> None:
        """
        Soft-delete an app from the database.

        Args:
            db: Database session.
            app: App instance.
        """
        try:
            app.is_deleted = True
            db.commit()
            logger.info("Soft-deleted app '%s'", app.name)

        except Exception as e:
            db.rollback()
            logger.exception(
                f"Failed to soft-delete app '{getattr(app, 'name', None)}': {str(e)}"
            )
            raise
    
    
    @staticmethod
    def get_apps_last_sync(db: Session, user_id: Optional[int] = None) -> List[App]:
        """
        Retrieve all active applications with their last synchronization timestamp.

        Args:
            db (Session): Database session.
            user_id: Optional User ID to filter by.

        Returns:
            List[App]: List of active applications ordered by name.

        Raises:
            Exception: If the application records cannot be retrieved.
        """
        try:
            query = db.query(App).filter(App.is_competitor == False, App.is_deleted == False)
            if user_id is not None:
                query = query.filter(
                    (App.user_id == user_id) |
                    (App.collaborators.any(id=user_id))
                )
            return (
                query.order_by(App.name.asc())
                .all()
            )
        except Exception as e:
            logger.exception(f"Failed to retrieve app last sync details: {str(e)}")
            raise


    @staticmethod
    def update_last_synced(db: Session, app: App) -> None:
        """
        Update the last synchronization timestamp for an application.

        Args:
            db (Session): Database session.
            app (App): Application to update.

        Raises:
            Exception: If the update operation fails.
        """
        try:
            app.last_synced_at = datetime.utcnow()
            db.commit()
            db.refresh(app)
        except Exception as e:
            db.rollback()
            logger.exception(
                f"Failed to update last sync for app '{app.name}': {str(e)}"
            )
            raise

    @staticmethod
    def add_competitor_to_app(db: Session, app: App, name: str, url: str) -> App:
        """
        Create or associate a competitor with a primary application.

        This method checks whether a competitor application with the given
        URL already exists for the current user. If it does not exist, a new
        competitor record is created. The competitor is then linked to the
        specified primary application if the relationship does not already
        exist.

        Raises:
            Exception:
                Propagates any database errors encountered while creating or
                linking the competitor.
        """
        try:
            competitor = db.query(App).filter(
                App.url == url,
                App.user_id == app.user_id,
                App.is_competitor == True
            ).first()

            if not competitor:
                competitor = App(name=name, url=url, user_id=app.user_id, is_competitor=True)
                db.add(competitor)
                db.commit()
                db.refresh(competitor)
                logger.info("Created new competitor app: %s", name)

            db.refresh(app)
            if competitor not in app.competitors:
                app.competitors.append(competitor)
                db.commit()
                db.refresh(app)
                logger.info("Linked competitor '%s' to primary app '%s'", name, app.name)

            return competitor

        except Exception as e:
            db.rollback()
            logger.exception(f"Failed to add competitor {name} to app {app.name}: {str(e)}")
            raise

    @staticmethod
    def remove_competitor_from_app(db: Session, app: App, competitor: App) -> None:
        """
        Remove the association between a competitor and a primary application.

        This method unlinks the specified competitor from the primary
        application. If the competitor is no longer associated with any
        other primary applications after the relationship is removed, the
        competitor record is permanently deleted from the database.

        Raises:
            Exception:
                Propagates any database errors encountered while removing
                the competitor or deleting orphaned records.
        """
        try:
            db.refresh(app)
            if competitor in app.competitors:
                app.competitors.remove(competitor)
                db.commit()
                db.refresh(competitor)
                
                if len(competitor.parent_apps) == 0:
                    db.delete(competitor)
                    db.commit()
                    logger.info("Deleted orphaned competitor app '%s'", competitor.name)
                else:
                    logger.info("Unlinked competitor '%s' from primary app '%s'", competitor.name, app.name)
        except Exception as e:
            db.rollback()
            logger.exception(f"Failed to remove competitor {competitor.name} from app {app.name}: {str(e)}")
            raise

    @staticmethod
    def create_invitation(db: Session, app_id: int, inviter_id: int, email: str) -> AppInvitation:
        """
        Create a new collaboration invitation for an application.

        This method normalizes the recipient's email address and checks
        whether a pending invitation already exists for the same
        application. If no active invitation is found, a new invitation
        record is created, persisted, and returned.

        Raises:
            Exception:
                Propagates any database errors encountered while creating
                the invitation.
        """
        try:
            email_normalized = email.strip().lower()
            invitation = db.query(AppInvitation).filter(
                AppInvitation.app_id == app_id,
                AppInvitation.email == email_normalized,
                AppInvitation.status == "pending"
            ).first()
            if invitation:
                return invitation

            invitation = AppInvitation(
                app_id=app_id,
                inviter_id=inviter_id,
                email=email_normalized,
                status="pending"
            )
            db.add(invitation)
            db.commit()
            db.refresh(invitation)
            logger.info("Created invitation for email '%s' on app_id=%s", email_normalized, app_id)
            return invitation
        except Exception as e:
            db.rollback()
            logger.exception(f"Failed to create invitation: {str(e)}")
            raise

    @staticmethod
    def get_pending_invitations(db: Session, email: str) -> List[AppInvitation]:
        """
        Retrieve all pending collaboration invitations for an email address.

        This method normalizes the provided email address and returns
        every invitation that is currently in the pending state for
        that recipient.

        Raises:
            Exception:
                Propagates any database errors encountered while retrieving
                pending invitations.
        """
        try:
            email_normalized = email.strip().lower()
            return db.query(AppInvitation).filter(
                AppInvitation.email == email_normalized,
                AppInvitation.status == "pending"
            ).all()
        except Exception as e:
            logger.exception(f"Failed to fetch pending invitations for {email}: {str(e)}")
            raise

    @staticmethod
    def get_invitation_by_id(db: Session, invitation_id: int) -> Optional[AppInvitation]:
        """
        Retrieve a collaboration invitation by its unique identifier.

        This method queries the database for a single invitation record
        matching the provided invitation ID and returns it if found.
        Otherwise, it returns ``None``.

        Raises:
            Exception:
                Propagates any database errors encountered while retrieving
                the invitation.
        """
        try:
            return db.query(AppInvitation).filter(AppInvitation.id == invitation_id).first()
        except Exception as e:
            logger.exception(f"Failed to get invitation by ID: {invitation_id} {str(e)}")
            raise

    @staticmethod
    def accept_invitation(db: Session, invitation: AppInvitation, user: User) -> None:
        """
        Accept a collaboration invitation and grant application access.

        This method updates the invitation status to accepted and adds
        the specified user as a collaborator on the associated
        application if they are not already a collaborator.

        Raises:
            Exception:
                Propagates any database errors encountered while accepting
                the invitation.
        """
        try:
            invitation.status = "accepted"
            app = invitation.app
            if user not in app.collaborators:
                app.collaborators.append(user)
            db.commit()
            logger.info("User %s accepted invitation to app %s", user.email, app.name)
        except Exception as e:
            db.rollback()
            logger.exception(f"Failed to accept invitation: {str(e)}")
            raise

    @staticmethod
    def decline_invitation(db: Session, invitation: AppInvitation) -> None:
        """
        Decline a collaboration invitation.

        This method updates the invitation status to declined and
        persists the change without modifying the application's
        collaborator list.

        Raises:
            Exception:
                Propagates any database errors encountered while declining
                the invitation.
        """
        try:
            invitation.status = "declined"
            db.commit()
            logger.info("Invitation %s was declined", invitation.id)
        except Exception as e:
            db.rollback()
            logger.exception(f"Failed to decline invitation: {str(e)}")
            raise


