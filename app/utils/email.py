import os
import base64
import requests as req_lib
from app.core.logger import get_logger

logger = get_logger(__name__)


def send_invitation_email(to_email: str, app_name: str, inviter_email: str) -> bool:
    """
    Send a collaboration invitation email using the AgentMail service.

    Attempts to send via the AgentMail Python SDK first. If the SDK is not
    installed or the call fails, it automatically falls back to the AgentMail
    HTTP REST API. If AGENTMAIL_INBOX_ID is not provided, a new inbox is
    created automatically using the client_id ``shopify-rank-tracker-inbox-v1``.

    SMTP credentials are no longer required; configure the following variables
    in ``.env`` instead::

        AGENTMAIL_API_KEY   – Your AgentMail API key (required).
        AGENTMAIL_INBOX_ID  – Sender inbox ID (optional; created on first use).
        AGENTMAIL_TO        – Fallback override for the recipient (optional).

    Args:
        to_email: Recipient's email address.
        app_name: Name of the application being shared.
        inviter_email: Email address of the user sending the invitation.

    Returns:
        bool:
            - True if the email was sent successfully.
            - False if AgentMail is not configured or an error occurs while
              sending the email.
    """
    api_key = os.getenv("AGENTMAIL_API_KEY")
    inbox_id = os.getenv("AGENTMAIL_INBOX_ID") or None

    if not api_key:
        logger.warning(
            "AGENTMAIL_API_KEY is not set in .env. Skipping invitation email."
        )
        return False

    subject = f"Invitation to collaborate on '{app_name}'"

    html_body = f"""
    <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <h2>Collaboration Invite</h2>
            <p>Hello,</p>
            <p><strong>{inviter_email}</strong> has invited you to collaborate on their
            application <strong>{app_name}</strong> on Shopify Rank Tracker.</p>
            <p>To accept or decline the invitation:</p>
            <ol>
                <li>Log into your Rank Tracker account (or register if you don't have one).</li>
                <li>Go to your <strong>Profile Settings</strong> page.</li>
                <li>Find the invitation under the <strong>"Pending Collaborator Invitations"</strong> section.</li>
            </ol>
            <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
            <p style="font-size: 11px; color: #999;">This automated message was sent via AgentMail.</p>
        </body>
    </html>
    """

    text_body = (
        f"{inviter_email} has invited you to collaborate on '{app_name}' "
        "on Shopify Rank Tracker.\n\n"
        "Log in to your account and visit Profile Settings > "
        "Pending Collaborator Invitations to respond."
    )

    logger.info(
        f"Preparing to send invitation email via AgentMail to {to_email}..."
    )

    try:
        from agentmail import AgentMail

        client = AgentMail(api_key=api_key)

        if not inbox_id:
            logger.info(
                "AGENTMAIL_INBOX_ID not set. Creating/fetching inbox via AgentMail SDK..."
            )
            inbox = client.inboxes.create(
                client_id="shopify-rank-tracker-inbox-v1"
            )
            inbox_id = (
                getattr(inbox, "inbox_id", None)
                or (inbox.get("inbox_id") if isinstance(inbox, dict) else str(inbox))
            )

        logger.info(
            f"Sending invitation email from inbox '{inbox_id}' to '{to_email}' via AgentMail SDK..."
        )
        client.inboxes.messages.send(
            inbox_id,
            to=to_email,
            subject=subject,
            text=text_body,
            html=html_body,
        )
        logger.info(
            f"Successfully sent invitation email to {to_email} via AgentMail SDK."
        )
        return True

    except ImportError:
        logger.info(
            "'agentmail' package not installed. Falling back to AgentMail HTTP API..."
        )
    except Exception as sdk_err:
        logger.warning(
            f"AgentMail SDK call failed: {sdk_err}. Falling back to AgentMail HTTP API..."
        )

    try:
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }

        if not inbox_id:
            res = req_lib.post(
                "https://api.agentmail.to/inboxes",
                headers=headers,
                json={"client_id": "shopify-rank-tracker-inbox-v1"},
                timeout=30,
            )
            if res.status_code in (200, 201):
                inbox_id = res.json().get("inbox_id")
            else:
                logger.error(
                    f"Failed to create AgentMail inbox: HTTP {res.status_code} – {res.text}"
                )
                return False

        url = f"https://api.agentmail.to/inboxes/{inbox_id}/messages/send"
        payload = {
            "to": to_email,
            "subject": subject,
            "text": text_body,
            "html": html_body,
        }

        r = req_lib.post(url, headers=headers, json=payload, timeout=30)
        if r.status_code in (200, 201):
            logger.info(
                f"Successfully sent invitation email to {to_email} via AgentMail REST API."
            )
            return True
        else:
            logger.error(
                f"AgentMail REST API error: HTTP {r.status_code} – {r.text}"
            )
            return False

    except Exception as e:
        logger.exception(f"Failed to send invitation email via AgentMail API: {e}")
        return False


def send_ranking_email(to_email: str, results: list[dict]) -> bool:
    """
    Send a cron rank-tracking summary email using the AgentMail service.

    Builds an HTML table of each app's keyword rankings and delivers it via
    the AgentMail Python SDK with an automatic REST API fallback (same
    pattern as :func:`send_invitation_email`).

    Args:
        to_email: Recipient's email address (the tracked user).
        results:  List of tracking result dicts produced by
                  :class:`~app.services.tracker_service.TrackerService`.
                  Each dict has keys: ``app_name``, ``keyword``, ``rank``,
                  ``page``, ``found``, ``is_competitor``.

    Returns:
        bool:
            - True  if the email was sent successfully.
            - False if AgentMail is not configured or an error occurs.
    """
    from collections import defaultdict
    from datetime import datetime, timezone

    api_key = os.getenv("AGENTMAIL_API_KEY")
    inbox_id = os.getenv("AGENTMAIL_INBOX_ID") or None

    if not api_key:
        logger.warning(
            "AGENTMAIL_API_KEY is not set in .env. Skipping ranking summary email."
        )
        return False

    now = datetime.now(tz=timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    grouped: dict[str, list[dict]] = defaultdict(list)
    for r in results:
        if not r.get("is_competitor"):
            grouped[r["app_name"]].append(r)

    app_sections = ""
    for app_name, app_results in grouped.items():
        rows = ""
        for r in app_results:
            keyword = r.get("keyword", "—")
            if r.get("found"):
                rank_cell = f"#{r.get('rank', '?')} &nbsp;<span style=\"color:#6c757d;font-size:12px\">(Page {r.get('page', '?')})</span>"
            else:
                rows += (
                    f"<tr>"
                    f"<td style='padding:6px 12px;border-bottom:1px solid #f0f0f0'>{keyword}</td>"
                    f"<td style='padding:6px 12px;border-bottom:1px solid #f0f0f0;color:#dc3545'>❌ Not found</td>"
                    f"</tr>"
                )
                continue
            rows += (
                f"<tr>"
                f"<td style='padding:6px 12px;border-bottom:1px solid #f0f0f0'>{keyword}</td>"
                f"<td style='padding:6px 12px;border-bottom:1px solid #f0f0f0'>{rank_cell}</td>"
                f"</tr>"
            )
        app_sections += f"""
        <h3 style="margin:24px 0 8px;color:#343a40">🏪 {app_name}</h3>
        <table style="width:100%;border-collapse:collapse;font-size:14px">
            <thead>
                <tr style="background:#f8f9fa">
                    <th style="text-align:left;padding:8px 12px;border-bottom:2px solid #dee2e6">Keyword</th>
                    <th style="text-align:left;padding:8px 12px;border-bottom:2px solid #dee2e6">Rank</th>
                </tr>
            </thead>
            <tbody>{rows}</tbody>
        </table>"""

    subject = f"📊 Rank Tracking Report — {now}"
    html_body = f"""
    <html>
        <body style="font-family:Arial,sans-serif;color:#333;max-width:640px;margin:0 auto;padding:24px">
            <h2 style="color:#212529">📊 Rank Tracking Report</h2>
            <p style="color:#6c757d;font-size:13px">Completed at {now}</p>
            <hr style="border:0;border-top:1px solid #dee2e6;margin:16px 0"/>
            {app_sections}
            <hr style="border:0;border-top:1px solid #dee2e6;margin:24px 0"/>
            <p style="font-size:11px;color:#adb5bd">This automated report was sent by Shopify Rank Tracker via AgentMail.</p>
        </body>
    </html>
    """
    text_body = f"📊 Rank Tracking Report — {now}\n\n" + "\n".join(
        f"{r['app_name']} | {r.get('keyword','—')} | "
        + (f"Rank #{r.get('rank')} (Page {r.get('page')})" if r.get("found") else "Not found")
        for r in results
        if not r.get("is_competitor")
    )

    logger.info(f"Preparing to send ranking summary email via AgentMail to {to_email}...")

    try:
        from agentmail import AgentMail

        client = AgentMail(api_key=api_key)

        if not inbox_id:
            logger.info("AGENTMAIL_INBOX_ID not set. Creating/fetching inbox via AgentMail SDK...")
            inbox = client.inboxes.create(client_id="shopify-rank-tracker-inbox-v1")
            inbox_id = (
                getattr(inbox, "inbox_id", None)
                or (inbox.get("inbox_id") if isinstance(inbox, dict) else str(inbox))
            )

        client.inboxes.messages.send(
            inbox_id,
            to=to_email,
            subject=subject,
            text=text_body,
            html=html_body,
        )
        logger.info(f"Successfully sent ranking summary email to {to_email} via AgentMail SDK.")
        return True

    except ImportError:
        logger.info("'agentmail' package not installed. Falling back to AgentMail HTTP API...")
    except Exception as sdk_err:
        logger.warning(f"AgentMail SDK call failed: {sdk_err}. Falling back to AgentMail HTTP API...")

    try:
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }

        if not inbox_id:
            res = req_lib.post(
                "https://api.agentmail.to/inboxes",
                headers=headers,
                json={"client_id": "shopify-rank-tracker-inbox-v1"},
                timeout=30,
            )
            if res.status_code in (200, 201):
                inbox_id = res.json().get("inbox_id")
            else:
                logger.error(
                    f"Failed to create AgentMail inbox: HTTP {res.status_code} – {res.text}"
                )
                return False

        url = f"https://api.agentmail.to/inboxes/{inbox_id}/messages/send"
        r = req_lib.post(
            url,
            headers=headers,
            json={"to": to_email, "subject": subject, "text": text_body, "html": html_body},
            timeout=30,
        )
        if r.status_code in (200, 201):
            logger.info(f"Successfully sent ranking summary email to {to_email} via AgentMail REST API.")
            return True
        logger.error(f"AgentMail REST API error: HTTP {r.status_code} – {r.text}")
        return False

    except Exception as e:
        logger.exception(f"Failed to send ranking summary email via AgentMail API: {e}")
        return False

