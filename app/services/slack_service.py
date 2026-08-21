import os
import requests
from dotenv import load_dotenv
from datetime import datetime, timezone

from app.core.logger import get_logger

load_dotenv()  

logger = get_logger(__name__)

_SLACK_API = os.getenv("SLACK_API")


def _bot_token() -> str | None:
    return os.getenv("SLACK_BOT_TOKEN")


def _headers() -> dict:
    return {
        "Authorization": f"Bearer {_bot_token()}",
        "Content-Type": "application/json",
    }


class SlackService:
    """
    Provides Slack Web API helpers for the rank-tracker notification flow.

    All methods are class methods (stateless). A SLACK_BOT_TOKEN must be set
    in the environment for any of them to work. Required OAuth scopes:

        users:read          – list users
        users:read.email    – look up by e-mail
        chat:write          – post messages
        im:write            – open DM channels
    """

    @classmethod
    def lookup_user_by_email(cls, email: str) -> str | None:
        """
        Return the Slack user-id for *email*, or None if not found / not
        configured.

        Args:
            email: The user's e-mail address to look up in Slack.

        Returns:
            Slack user id string (e.g. ``"U012AB3CD"``) or ``None``.
        """
        token = _bot_token()
        if not token:
            logger.warning(
                "SLACK_BOT_TOKEN is not set; skipping Slack user lookup for %s.", email
            )
            return None

        try:
            resp = requests.get(
                f"{_SLACK_API}/users.lookupByEmail",
                headers=_headers(),
                params={"email": email},
                timeout=10,
            )
            data = resp.json()
            if data.get("ok"):
                user_id = data["user"]["id"]
                logger.info("Slack user found for email=%s → %s", email, user_id)
                return user_id

            error = data.get("error", "unknown")
            if error != "users_not_found":
                logger.warning(
                    "Slack users.lookupByEmail returned error '%s' for email=%s.",
                    error,
                    email,
                )
            return None

        except Exception as exc:
            logger.exception(
                "Exception while looking up Slack user for email=%s: %s", email, exc
            )
            return None


    @classmethod
    def send_dm(cls, slack_user_id: str, results: list[dict]) -> bool:
        """
        Send a Block Kit ranking summary as a DM to the given Slack user.

        Args:
            slack_user_id: Slack user id (e.g. ``"U012AB3CD"``).
            results: List of tracking result dicts produced by
                     :class:`~app.services.tracker_service.TrackerService`.
                     Each dict has keys: ``app_name``, ``keyword``, ``rank``,
                     ``page``, ``found``, ``is_competitor``.

        Returns:
            ``True`` if the message was sent successfully, ``False`` otherwise.
        """
        token = _bot_token()
        if not token:
            return False

        try:
            open_resp = requests.post(
                f"{_SLACK_API}/conversations.open",
                headers=_headers(),
                json={"users": slack_user_id},
                timeout=10,
            )
            open_data = open_resp.json()
            if not open_data.get("ok"):
                logger.error(
                    "conversations.open failed for user %s: %s",
                    slack_user_id,
                    open_data.get("error"),
                )
                return False
            channel_id = open_data["channel"]["id"]
        except Exception as exc:
            logger.exception(
                "Exception opening DM channel for Slack user %s: %s", slack_user_id, exc
            )
            return False

        blocks = cls._build_blocks(results)

        try:
            post_resp = requests.post(
                f"{_SLACK_API}/chat.postMessage",
                headers=_headers(),
                json={
                    "channel": channel_id,
                    "blocks": blocks,
                    "text": "📊 Rank Tracking Report",
                },
                timeout=15,
            )
            post_data = post_resp.json()
            if post_data.get("ok"):
                logger.info("Slack DM sent successfully to user %s.", slack_user_id)
                return True
            logger.error(
                "chat.postMessage failed for user %s: %s",
                slack_user_id,
                post_data.get("error"),
            )
            return False
        except Exception as exc:
            logger.exception(
                "Exception posting Slack DM to user %s: %s", slack_user_id, exc
            )
            return False


    @staticmethod
    def _build_blocks(results: list[dict]) -> list[dict]:
        """
        Build a Slack Block Kit payload from the tracking results.

        Groups results by ``app_name`` and creates one section per app listing
        each keyword with its rank and page, or a ❌ if not found.
        Competitor results are excluded.

        Args:
            results: List of tracker result dicts.

        Returns:
            List of Slack block dicts.
        """
        from collections import defaultdict

        grouped: dict[str, list[dict]] = defaultdict(list)
        for r in results:
            if not r.get("is_competitor"):
                grouped[r["app_name"]].append(r)

        now = datetime.now(tz=timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

        blocks: list[dict] = [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": "📊 Rank Tracking Report",
                    "emoji": True,
                },
            },
            {
                "type": "context",
                "elements": [
                    {"type": "mrkdwn", "text": f"Completed at *{now}*"}
                ],
            },
            {"type": "divider"},
        ]

        for app_name, app_results in grouped.items():
            blocks.append(
                {
                    "type": "section",
                    "text": {"type": "mrkdwn", "text": f"*🏪 {app_name}*"},
                }
            )

            lines = []
            for r in app_results:
                keyword = r.get("keyword", "—")
                if r.get("found"):
                    rank = r.get("rank", "?")
                    page = r.get("page", "?")
                    lines.append(f"• `{keyword}` → *Rank #{rank}* (Page {page})")
                else:
                    lines.append(f"• `{keyword}` → ❌ Not found")

            blocks.append(
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": "\n".join(lines) or "_No keywords tracked._",
                    },
                }
            )
            blocks.append({"type": "divider"})

        return blocks
