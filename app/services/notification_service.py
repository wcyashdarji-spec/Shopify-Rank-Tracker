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
    def notify_user(cls, user_email: str, user_results: list[dict]) -> None:
        """
        Send a ranking summary notification to *user_email*.

        Tries Slack first; falls back to e-mail via AgentMail.

        Args:
            user_email:   The user's registered e-mail address.
            user_results: List of tracking result dicts for this user only.
                          Each dict has keys: ``app_name``, ``keyword``,
                          ``rank``, ``page``, ``found``, ``is_competitor``.
        """
        if not user_results:
            logger.info(
                "No results to notify for user %s; skipping notification.", user_email
            )
            return

        try:
            slack_user_id = SlackService.lookup_user_by_email(user_email)
            if slack_user_id:
                logger.info(
                    "Sending Slack DM to user %s (Slack id: %s).",
                    user_email,
                    slack_user_id,
                )
                SlackService.send_dm(slack_user_id, user_results)
            else:
                logger.info(
                    "User %s not found in Slack; falling back to AgentMail.", user_email
                )
                send_ranking_email(user_email, user_results)
        except Exception as exc:
            logger.exception(
                "Unexpected error while notifying user %s: %s", user_email, exc
            )
            raise
