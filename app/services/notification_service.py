from app.core.logger import get_logger
from app.utils.email import send_ranking_email
from app.services.slack_service import SlackService

logger = get_logger(__name__)


class NotificationService:
    """
    Orchestrates post-cron notifications for a single user.

    Delivery order:
    1. Look up the user's e-mail in the Slack workspace.
       - If found  → send a Slack DM with the ranking summary.
       - If not found or Slack is not configured → fall back to AgentMail.
    2. All errors are caught and logged; a notification failure must never
       break the cron run.
    """

    @classmethod
    def notify_user(cls, user_email: str, user_results: list[dict], db: any = None) -> None:
        """
        Send a ranking summary notification to *user_email*.

        Delivery flow:
        1. Query user's active Slack workspace integration from database.
           - If active workspace found  → send notification to user's Slack workspace.
        2. If Slack is not configured or fails → fall back to AgentMail email.

        Args:
            user_email:   The user's registered e-mail address.
            user_results: List of tracking result dicts for this user only.
            db:           Optional SQLAlchemy database Session object.
        """
        if not user_results:
            logger.info(
                "No results to notify for user %s; skipping notification.", user_email
            )
            return

        try:
            sent_via_slack = False

            active_db = db
            created_session = False
            if active_db is None:
                try:
                    from app.db import SessionLocal
                    active_db = SessionLocal()
                    created_session = True
                except Exception as db_err:
                    logger.warning("Could not create DB session for Slack notification: %s", db_err)

            if active_db:
                try:
                    from app.db.models import User, SlackIntegration
                    user = active_db.query(User).filter(User.email == user_email).first()
                    if user:
                        slack_integration = (
                            active_db.query(SlackIntegration)
                            .filter(
                                SlackIntegration.user_id == user.id,
                                SlackIntegration.is_active == True,
                            )
                            .first()
                        )
                        if slack_integration:
                            logger.info(
                                "Found active Slack workspace '%s' for user %s. Dispatching notification...",
                                slack_integration.workspace_name,
                                user_email,
                            )
                            sent_via_slack = SlackService.send_to_workspace(
                                slack_integration, user_results, user_email
                            )
                except Exception as exc:
                    logger.warning("Error checking active Slack integration in DB for %s: %s", user_email, exc)
                finally:
                    if created_session and active_db:
                        active_db.close()

            if not sent_via_slack:
                slack_user_id = SlackService.lookup_user_by_email(user_email)
                if slack_user_id:
                    logger.info(
                        "Sending Slack DM to user %s (Slack id: %s).",
                        user_email,
                        slack_user_id,
                    )
                    sent_via_slack = SlackService.send_dm(slack_user_id, user_results)

            if not sent_via_slack:
                logger.info(
                    "User %s Slack notification not delivered; falling back to email via AgentMail.", user_email
                )
                send_ranking_email(user_email, user_results)

        except Exception as exc:
            logger.exception(
                "Unexpected error while notifying user %s: %s", user_email, exc
            )
            raise
