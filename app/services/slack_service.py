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
    def send_to_workspace(cls, integration: any, results: list[dict], user_email: str) -> bool:
        """
        Send a ranking summary to the user's configured active Slack workspace.

        The notification is sent using the following priority:

        1. Slack incoming webhook URL, when configured.
        2. Slack bot token with the configured channel.
        3. Slack bot token with a direct message to the user's Slack account,
        resolved using their email address.

        Args:
            integration: Slack integration containing webhook URL, bot token,
                workspace name, and optional channel information.
            results: Ranking results used to build the Slack message blocks.
            user_email: Email address of the user receiving the notification.

        Returns:
            True if the notification was successfully delivered through either
            the webhook or bot-token flow; otherwise False.

        Notes:
            Exceptions are logged and handled internally so that a Slack
            notification failure does not interrupt the calling workflow.
        """
        blocks = cls._build_blocks(results)

        if getattr(integration, "webhook_url", None):
            allowed_prefix = os.getenv("ALLOWED_SLACK_WEBHOOK_PREFIX")
            if not integration.webhook_url.startswith(allowed_prefix):
                logger.error(
                    "Rejected webhook URL that does not match allowed prefix '%s': %s",
                    allowed_prefix,
                    integration.webhook_url,
                )
            else:
                try:
                    resp = requests.post(
                        integration.webhook_url,
                        json={
                            "text": f"📊 Rank Tracking Report for {user_email}",
                            "blocks": blocks,
                        },
                        timeout=15,
                    )
                    if resp.status_code == 200:
                        logger.info(
                            "Sent Slack notification via Webhook URL to workspace '%s'.",
                            getattr(integration, "workspace_name", "Slack"),
                        )
                        return True
                    logger.warning("Slack webhook returned status %d: %s", resp.status_code, resp.text)
                except Exception as exc:
                    logger.exception(
                        "Exception posting to Slack webhook for workspace '%s': %s",
                        getattr(integration, "workspace_name", "Slack"),
                        exc,
                    )

        token = getattr(integration, "bot_token", None) or _bot_token()
        if token:
            headers = {
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            }
            channel = getattr(integration, "channel_name", None)

            if not channel:
                try:
                    user_resp = requests.get(
                        f"{_SLACK_API}/users.lookupByEmail",
                        headers=headers,
                        params={"email": user_email},
                        timeout=10,
                    )
                    u_data = user_resp.json()
                    if u_data.get("ok"):
                        slack_uid = u_data["user"]["id"]
                        open_resp = requests.post(
                            f"{_SLACK_API}/conversations.open",
                            headers=headers,
                            json={"users": slack_uid},
                            timeout=10,
                        )
                        o_data = open_resp.json()
                        if o_data.get("ok"):
                            channel = o_data["channel"]["id"]
                except Exception as exc:
                    logger.exception("Exception looking up user DM for workspace: %s", exc)

            if channel:
                target_channel = channel if (channel.startswith("C") or channel.startswith("D") or channel.startswith("G") or channel.startswith("#")) else f"#{channel}"
                try:
                    post_resp = requests.post(
                        f"{_SLACK_API}/chat.postMessage",
                        headers=headers,
                        json={
                            "channel": target_channel,
                            "blocks": blocks,
                            "text": f"📊 Rank Tracking Report for {user_email}",
                        },
                        timeout=15,
                    )
                    p_data = post_resp.json()
                    if p_data.get("ok"):
                        logger.info(
                            "Sent Slack notification via Bot Token to channel '%s' in workspace '%s'.",
                            target_channel,
                            getattr(integration, "workspace_name", "Slack"),
                        )
                        return True
                    logger.error(
                        "chat.postMessage failed for workspace '%s': %s",
                        getattr(integration, "workspace_name", "Slack"),
                        p_data.get("error"),
                    )
                except Exception as exc:
                    logger.exception("Exception posting Slack message via Bot Token: %s", exc)

        return False

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

        Groups results by ``app_name`` for primary applications and competitor applications,
        creating sections for each app listing each keyword with its rank and page, or a ❌ if not found.

        Args:
            results: List of tracker result dicts.

        Returns:
            List of Slack block dicts.
        """
        from collections import defaultdict

        main_apps: dict[str, list[dict]] = defaultdict(list)
        comp_apps: dict[str, list[dict]] = defaultdict(list)

        for r in results:
            if r.get("is_competitor"):
                comp_apps[r["app_name"]].append(r)
            else:
                main_apps[r["app_name"]].append(r)

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

        if main_apps:
            blocks.append(
                {
                    "type": "section",
                    "text": {"type": "mrkdwn", "text": "*📱 Primary Applications*"},
                }
            )
            for app_name, app_results in main_apps.items():
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
                        lines.append(f"• `{keyword}` → ❌ Not Captured ")

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

        if comp_apps:
            blocks.append(
                {
                    "type": "section",
                    "text": {"type": "mrkdwn", "text": "*⚔️ Competitor Applications*"},
                }
            )
            for app_name, app_results in comp_apps.items():
                blocks.append(
                    {
                        "type": "section",
                        "text": {"type": "mrkdwn", "text": f"*🥊 {app_name} (Competitor)*"},
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
                        lines.append(f"• `{keyword}` → ❌ Not Captured")

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

        if not main_apps and not comp_apps:
            blocks.append(
                {
                    "type": "section",
                    "text": {"type": "mrkdwn", "text": "_No app rankings recorded._"},
                }
            )
            blocks.append({"type": "divider"})

        return blocks
