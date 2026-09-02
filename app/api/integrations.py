import os
import time
import secrets
from typing import Optional
from urllib.parse import urlencode

import requests
import redis.asyncio as aioredis
from sqlalchemy.orm import Session
from fastapi.responses import RedirectResponse
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.db import get_db
from app.core.redis import get_redis
from app.core.logger import get_logger
from app.api.auth_deps import get_current_user
from app.db.models import SlackIntegration, User
from app.core.cache import cache_get, cache_set, cache_invalidate_pattern, make_key, CACHE_TTL
from app.schemas.request import SlackIntegrationCreate, SlackIntegrationSaveRequest, SlackOAuthSimulateRequest

logger = get_logger(__name__)

router = APIRouter(prefix="/integrations", tags=["integrations"])


_slack_state_store: dict[str, tuple[int, float]] = {}

def _mask_token(token: str | None) -> str | None:
    """Return a masked representation of a Slack token suitable for API responses."""
    if not token:
        return None
    visible = token[:6] if len(token) >= 6 else token
    return f"{visible}****{token[-4:] if len(token) >= 10 else ''}"


@router.get("/slack")
async def get_slack_integrations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    redis: aioredis.Redis | None = Depends(get_redis),
):
    """
    Retrieve all Slack integrations configured for the authenticated user.

    Integrations are returned in descending order of creation time. The
    currently active integration is identified and returned as the selected
    integration. If no integration is active, the most recently created
    integration is selected as a fallback.

    Args:
        current_user: Authenticated user whose Slack integrations should be
            retrieved.
        db: SQLAlchemy database session used to query Slack integrations.

    Returns:
        A dictionary containing:

        * ``integrations``: List of Slack integration details, including
          workspace, webhook, bot token, channel, active status, and creation
          timestamp.
        * ``selected_integration_id``: ID of the active integration, or the
          first integration when none is active.
        * ``is_connected``: ``True`` when the user has at least one Slack
          integration configured; otherwise ``False``.
    """
    cache_key = make_key(f"user:{current_user.id}", "integrations", "slack")
    cached = await cache_get(redis, cache_key)
    if cached is not None:
        return cached

    try:
        integrations = (
            db.query(SlackIntegration)
            .filter(SlackIntegration.user_id == current_user.id)
            .order_by(SlackIntegration.created_at.desc())
            .all()
        )

        active_item = next((item for item in integrations if item.is_active), None)

        response_data = {
            "integrations": [
                {
                    "id": item.id,
                    "workspace_name": item.workspace_name,
                    "webhook_url": item.webhook_url,
                    "bot_token": _mask_token(item.bot_token),
                    "channel_name": item.channel_name,
                    "is_active": item.is_active,
                    "created_at": item.created_at.isoformat() if item.created_at else None,
                }
                for item in integrations
            ],
            "selected_integration_id": active_item.id if active_item else (integrations[0].id if integrations else None),
            "is_connected": len(integrations) > 0,
        }
        await cache_set(redis, cache_key, response_data, CACHE_TTL["integrations_slack"])
        return response_data
    except Exception as exc:
        logger.error("Error retrieving Slack integrations for user_id=%d: %s", current_user.id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve Slack integrations.",
        )
    

@router.get("/slack/auto-detect-workspace")
def auto_detect_user_workspace(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Automatically detect and suggest Slack workspace names for the
    authenticated user.

    Workspace suggestions are generated from multiple sources, in priority
    order:

    1. Previously saved Slack integrations belonging to the user.
    2. Applications registered by the user.
    3. The user's email domain or local-part when no organization-specific
       information is available.

    Common personal email providers such as Gmail, Yahoo, Hotmail, Outlook,
    and iCloud are excluded from organization-name detection. For these
    providers, the email local-part is used to generate a personalized
    workspace name instead.

    Args:
        current_user: Authenticated user whose workspace suggestions should
            be generated.
        db: SQLAlchemy database session used to retrieve the user's saved
            Slack integrations and registered applications.

    Returns:
        A dictionary containing:

        * ``workspace_name``: Primary workspace suggestion. Defaults to
          ``"My Workspace"`` when no suggestions are available.
        * ``suggested_workspaces``: Unique workspace names detected from the
          available user data.
        * ``user_email``: Email address associated with the authenticated user.

    Notes:
        Failure to query the user's registered applications does not fail the
        request. The exception is logged at debug level and workspace
        detection continues using the remaining available sources.
    """
    try:
        suggested = []

        existing_integrations = (
            db.query(SlackIntegration)
            .filter(SlackIntegration.user_id == current_user.id)
            .order_by(SlackIntegration.created_at.desc())
            .all()
        )
        for integ in existing_integrations:
            if integ.workspace_name and integ.workspace_name not in suggested:
                suggested.append(integ.workspace_name)

        try:
            from app.db.models import App
            user_apps = db.query(App).filter(App.user_id == current_user.id).all()
            for app_obj in user_apps:
                app_title = getattr(app_obj, "title", None) or getattr(app_obj, "name", None)
                if app_title and app_title not in suggested:
                    suggested.append(app_title)
        except Exception as exc:
            logger.debug("Could not query apps for workspace auto-detection: %s", exc)

        if current_user.email and "@" in current_user.email:
            email = current_user.email.strip().lower()
            domain = email.split("@")[1]
            ignore_domains = {"gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "icloud.com"}
            if domain not in ignore_domains:
                company_name = domain.split(".")[0].capitalize()
                if company_name and company_name not in suggested:
                    suggested.append(company_name)
            else:
                handle = email.split("@")[0].capitalize()
                if handle and handle not in suggested:
                    suggested.append(f"{handle}'s Workspace")

        primary_workspace = suggested[0] if suggested else "My Workspace"

        return {
            "workspace_name": primary_workspace,
            "suggested_workspaces": suggested,
            "user_email": current_user.email,
        }
    
    except Exception as exc:
        logger.error("Error auto-detecting Slack workspace for user_id=%d: %s", current_user.id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to auto-detect Slack workspace.",
        )


@router.get("/slack/authorize-url")
def get_slack_authorize_url(
    current_user: User = Depends(get_current_user),
):
    """
    Generate the Slack OAuth 2.0 authorization URL for the authenticated user.

    The Slack client ID and redirect URI are loaded from environment
    configuration. The generated URL includes the requested OAuth scopes and
    a state value containing the authenticated user's ID so the OAuth callback
    can associate the authorization request with the correct user.

    Args:
        current_user: Authenticated user initiating the Slack OAuth
            authorization flow.

    Returns:
        A dictionary containing:

        * ``configured``: ``True`` when ``SLACK_CLIENT_ID`` is configured;
          otherwise ``False``.
        * ``url``: Fully constructed Slack OAuth authorization URL when the
          integration is configured, otherwise ``None``.
        * ``message``: Configuration error message when the Slack client ID
          is not configured.

    Notes:
        The requested Slack OAuth scopes include permission to send messages,
        read users and email addresses, read channels, and access incoming
        webhooks.

        The ``state`` parameter is derived from the authenticated user's ID
        and should be validated during the OAuth callback to prevent
        authorization-request forgery.
    """
    try:
        client_id = os.getenv("SLACK_CLIENT_ID", "").strip()
        redirect_uri = os.getenv("SLACK_REDIRECT_URI")

        scopes = "chat:write,users:read,users:read.email,channels:read,incoming-webhook"

        state_token = secrets.token_urlsafe(32)
        _slack_state_store[state_token] = (current_user.id, time.time() + 600)

        if client_id:
            params = {
                "client_id": client_id,
                "scope": scopes,
                "redirect_uri": redirect_uri,
                "state": state_token,
            }
            oauth_url = f"https://slack.com/oauth/v2/authorize?{urlencode(params)}"
            return {
                "configured": True,
                "url": oauth_url,
            }

        return {
            "configured": False,
            "url": None,
            "message": "SLACK_CLIENT_ID environment variable is not set.",
        }
    
    except Exception as exc:
        logger.error("Error generating Slack OAuth authorize URL for user_id=%d: %s", current_user.id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate Slack OAuth authorize URL.",
        )


@router.get("/slack/oauth/callback")
async def slack_oauth_callback(
    code: Optional[str] = Query(None),
    state: Optional[str] = Query(None),
    error: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    redis: aioredis.Redis | None = Depends(get_redis),
):
    """
    Handle the Slack OAuth callback and save the authorized integration.

    Exchanges the authorization code with Slack, retrieves workspace and
    webhook details, deactivates existing integrations for the user, and
    stores the newly authorized integration as active.

    Args:
        code: Authorization code returned by Slack.
        state: OAuth state used to identify the authorization request.
        error: OAuth error returned when Slack authorization fails.
        db: Database session used to persist the Slack integration.

    Returns:
        Redirects the user to the frontend with the Slack connection status.

    Raises:
        HTTPException: If the authorization code is missing or Slack token
            exchange fails.
    """
    try:
        frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/")

        if error:
            logger.error("Slack OAuth authorization error: %s", error)
            return RedirectResponse(url=f"{frontend_url}/?{urlencode({'slack_error': error})}")

        if not code:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Authorization code missing from callback.",
            )

        state_entry = _slack_state_store.pop(state, None)
        if not state_entry or time.time() > state_entry[1]:
            logger.warning("Slack OAuth callback: invalid or expired state token.")
            return RedirectResponse(
                url=f"{frontend_url}/?{urlencode({'slack_error': 'invalid_state'})}"
            )
        user_id = state_entry[0]

        user_record = db.query(User).filter(User.id == user_id).first()
        if not user_record:
            logger.error("Slack OAuth callback: user_id=%d not found.", user_id)
            return RedirectResponse(
                url=f"{frontend_url}/?{urlencode({'slack_error': 'user_not_found'})}"
            )

        client_id = os.getenv("SLACK_CLIENT_ID", "").strip()
        client_secret = os.getenv("SLACK_CLIENT_SECRET", "").strip()
        redirect_uri = os.getenv("SLACK_REDIRECT_URI")

        if not client_secret:
            logger.error("SLACK_CLIENT_SECRET is not configured; cannot complete OAuth exchange.")
            return RedirectResponse(
                url=f"{frontend_url}/?{urlencode({'slack_error': 'server_not_configured'})}"
            )

        resp = requests.post(
            "https://slack.com/api/oauth.v2.access",
            data={
                "client_id": client_id,
                "client_secret": client_secret,
                "code": code,
                "redirect_uri": redirect_uri,
            },
            timeout=15,
        )
        data = resp.json()

        if not data.get("ok"):
            err_msg = data.get("error", "Failed to exchange OAuth token with Slack")
            logger.error("Slack OAuth token exchange failed: %s", err_msg)
            return RedirectResponse(
                url=f"{frontend_url}/?{urlencode({'slack_error': err_msg})}"
            )

        team_info = data.get("team", {})
        workspace_name = team_info.get("name", "Slack Workspace")
        bot_token = data.get("access_token")
        incoming_webhook = data.get("incoming_webhook", {})
        webhook_url = incoming_webhook.get("url")
        channel_name = incoming_webhook.get("channel", "general")

        if not bot_token:
            logger.error("Slack OAuth exchange returned no access_token for user_id=%d", user_id)
            return RedirectResponse(
                url=f"{frontend_url}/?{urlencode({'slack_error': 'no_token_returned'})}"
            )

        db.query(SlackIntegration).filter(SlackIntegration.user_id == user_id).update({"is_active": False})

        new_integration = SlackIntegration(
            user_id=user_id,
            workspace_name=workspace_name,
            bot_token=bot_token,
            webhook_url=webhook_url,
            channel_name=channel_name,
            is_active=True,
        )
        db.add(new_integration)
        db.commit()
        db.refresh(new_integration)

        logger.info(
            "Successfully authorized Slack workspace '%s' via OAuth2 for user_id=%d",
            workspace_name,
            user_id,
        )

        await cache_invalidate_pattern(redis, make_key(f"user:{user_id}", "integrations", "slack"))

        return RedirectResponse(
            url=f"{frontend_url}/?{urlencode({'slack_connected': 'true', 'workspace': workspace_name})}"
        )
    except Exception as e:
        logger.error("slack_oauth_callback failed: %s", e, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to Handle the Slack OAuth callback and save the authorized integration.",
        )


@router.post("/slack/oauth/simulate")
async def simulate_slack_oauth_exchange(
    payload: SlackOAuthSimulateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    redis: aioredis.Redis | None = Depends(get_redis),
):
    """
    Simulate a Slack OAuth2 authorization and create a test integration.

    Validates the requested workspace, deactivates the user's existing active
    integrations, generates simulated OAuth credentials, and stores the new
    integration as active.

    Args:
        payload: Request containing the workspace and optional channel name.
        current_user: Authenticated user creating the simulated integration.
        db: Database session used to persist the integration.

    Returns:
        A dictionary containing a success message and the newly created
        Slack integration details.

    Raises:
        HTTPException: If the workspace name is missing or the integration
            cannot be saved.
    """
    try:
        if not payload.workspace_name or not payload.workspace_name.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Workspace name is required.",
            )

        workspace_name = payload.workspace_name.strip()
        channel_name = payload.channel_name.strip() if payload.channel_name else None

        db.query(SlackIntegration).filter(SlackIntegration.user_id == current_user.id).update({"is_active": False})

        simulated_bot_token = f"xoxb-oauth-{current_user.id}-{workspace_name.lower().replace(' ', '-')}"
        simulated_webhook = f"https://hooks.slack.com/services/oauth/{workspace_name.lower()}"

        new_integration = SlackIntegration(
            user_id=current_user.id,
            workspace_name=workspace_name,
            bot_token=simulated_bot_token,
            webhook_url=simulated_webhook,
            channel_name=channel_name,
            is_active=True,
        )
        db.add(new_integration)
        db.commit()
        db.refresh(new_integration)

        logger.info(
            "Backend OAuth2 authorization simulation succeeded for workspace '%s' (user_id=%d)",
            workspace_name,
            current_user.id,
        )

        await cache_invalidate_pattern(redis, make_key(f"user:{current_user.id}", "integrations", "slack"))

        return {
            "message": f"Slack workspace '{workspace_name}' authorized successfully via Backend OAuth2.",
            "integration": {
                "id": new_integration.id,
                "workspace_name": new_integration.workspace_name,
                "webhook_url": new_integration.webhook_url,
                "bot_token": _mask_token(new_integration.bot_token),
                "channel_name": new_integration.channel_name,
                "is_active": new_integration.is_active,
                "created_at": new_integration.created_at.isoformat() if new_integration.created_at else None,
            },
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error("simulate_slack_oauth_exchange failed: %s", e, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to Simulate a Slack OAuth2 authorization and create a test integration.",
        )


@router.post("/slack/test-notification")
def send_test_slack_notification(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Send a test Slack notification to the authenticated user's active workspace.

    The endpoint retrieves the user's active Slack integration, sends a sample
    ranking notification through the Slack service, and returns the delivery
    status.

    Args:
        current_user: Authenticated user making the request.
        db: Active database session.

    Returns:
        A message indicating whether the test notification was delivered.

    Raises:
        HTTPException: If no active Slack integration exists or an unexpected
            error occurs while processing the request.
    """
    slack_integration = (
        db.query(SlackIntegration)
        .filter(SlackIntegration.user_id == current_user.id, SlackIntegration.is_active == True)
        .first()
    )
    if not slack_integration:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active Slack workspace connected. Please connect a Slack workspace first.",
        )

    sample_results = [
        {
            "app_name": "Shopify Rank Tracker",
            "keyword": "checkout customization",
            "rank": 1,
            "page": 1,
            "found": True,
            "is_competitor": False,
        },
        {
            "app_name": "Competitor Checkout Plus",
            "keyword": "checkout customization",
            "rank": 4,
            "page": 1,
            "found": True,
            "is_competitor": True,
        },
    ]

    from app.services.slack_service import SlackService
    success = SlackService.send_to_workspace(slack_integration, sample_results, current_user.email)
    if success:
        return {"message": f"🎉 Test alert delivered to Slack workspace '{slack_integration.workspace_name}'!"}

    return {"message": f"Test alert dispatched to workspace '{slack_integration.workspace_name}'."}


@router.post("/slack")
async def create_slack_integration(
    payload: SlackIntegrationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    redis: aioredis.Redis | None = Depends(get_redis),
):
    """
    Create and activate a new Slack workspace integration.

    Deactivates any existing Slack integrations for the authenticated user
    before storing the new integration as the active workspace.

    Args:
        payload: Slack integration details including workspace name,
            webhook URL, bot token, and optional channel name.
        current_user: Authenticated user creating the integration.
        db: Database session used to persist the integration.

    Returns:
        A dictionary containing a success message and the newly created
        Slack integration details.

    Raises:
        HTTPException: If the workspace name is empty or the integration
            cannot be saved.
    """
    try:
        if not payload.workspace_name.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Workspace name is required.",
            )

        db.query(SlackIntegration).filter(SlackIntegration.user_id == current_user.id).update({"is_active": False})

        new_integration = SlackIntegration(
            user_id=current_user.id,
            workspace_name=payload.workspace_name.strip(),
            webhook_url=payload.webhook_url.strip() if payload.webhook_url else None,
            bot_token=payload.bot_token.strip() if payload.bot_token else None,
            channel_name=payload.channel_name.strip() if payload.channel_name else None,
            is_active=True,
        )
        db.add(new_integration)
        db.commit()
        db.refresh(new_integration)

        logger.info("Created Slack integration '%s' for user_id=%d", new_integration.workspace_name, current_user.id)

        await cache_invalidate_pattern(redis, make_key(f"user:{current_user.id}", "integrations", "slack"))

        return {
            "message": "Slack workspace connected successfully.",
            "integration": {
                "id": new_integration.id,
                "workspace_name": new_integration.workspace_name,
                "webhook_url": new_integration.webhook_url,
                "bot_token": _mask_token(new_integration.bot_token),
                "channel_name": new_integration.channel_name,
                "is_active": new_integration.is_active,
                "created_at": new_integration.created_at.isoformat() if new_integration.created_at else None,
            },
        }

    except HTTPException:
        raise
    except Exception as exc:
        db.rollback()
        logger.error(
            "Failed to create Slack integration for user_id=%d: %s",
            current_user.id,
            exc,
            exc_info=True,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create Slack integration.",
        ) from exc


@router.put("/slack/save")
async def save_slack_integration_selection(
    payload: SlackIntegrationSaveRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    redis: aioredis.Redis | None = Depends(get_redis),
):
    """
    Save active Slack workspace selection.
    """
    db.query(SlackIntegration).filter(SlackIntegration.user_id == current_user.id).update({"is_active": False})

    if payload.selected_integration_id:
        target = (
            db.query(SlackIntegration)
            .filter(
                SlackIntegration.id == payload.selected_integration_id,
                SlackIntegration.user_id == current_user.id,
            )
            .first()
        )
        if target:
            target.is_active = True

    db.commit()

    await cache_invalidate_pattern(redis, make_key(f"user:{current_user.id}", "integrations", "slack"))

    return {"message": "Slack integration preferences saved successfully."}


@router.delete("/slack/{integration_id}")
async def delete_slack_integration(
    integration_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    redis: aioredis.Redis | None = Depends(get_redis),
):
    """
    Save the selected Slack workspace integration as the active integration.

    This endpoint deactivates all existing Slack integrations for the
    authenticated user and activates the selected integration when a valid
    integration ID is provided.

    Args:
        payload: Request containing the selected Slack integration ID.
        current_user: Authenticated user making the request.
        db: Active database session.

    Returns:
        A success message confirming that the Slack integration preferences
        were saved.

    Raises:
        HTTPException: If an unexpected database or persistence error occurs.
    """
    try:
        target = (
            db.query(SlackIntegration)
            .filter(
                SlackIntegration.id == integration_id,
                SlackIntegration.user_id == current_user.id,
            )
            .first()
        )

        if not target:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Integration not found.",
            )

        db.delete(target)
        db.commit()

        await cache_invalidate_pattern(redis, make_key(f"user:{current_user.id}", "integrations", "slack"))

        return {"message": "Slack workspace removed."}
    
    except Exception as exc:
        db.rollback()
        logger.error(
            "[Slack:save] Failed to save integration selection for user_id=%d: %s",
            current_user.id,
            exc,
            exc_info=True,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save Slack integration preferences.",
        )


@router.delete("/slack")
async def remove_all_slack_integrations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    redis: aioredis.Redis | None = Depends(get_redis),
):
    """
    Remove all Slack integrations configured for the authenticated user.

    Deletes every Slack integration associated with the current user from
    the database and commits the changes.

    Args:
        current_user: Authenticated user making the request.
        db: Active database session.

    Returns:
        A success message confirming that the Slack integrations were removed.

    Raises:
        HTTPException: If an unexpected database or persistence error occurs.
    """
    try:
        deleted_count = (
            db.query(SlackIntegration)
            .filter(SlackIntegration.user_id == current_user.id)
            .delete()
        )

        db.commit()

        logger.info(
            "Removed %d Slack integration(s) for user_id=%d",
            deleted_count,
            current_user.id,
        )

        await cache_invalidate_pattern(redis, make_key(f"user:{current_user.id}", "integrations", "slack"))

        return {
            "message": "Slack integration removed successfully."
        }

    except Exception as exc:
        db.rollback()
        logger.error(
            "[Slack:remove] Failed to remove integrations for user_id=%d: %s",
            current_user.id,
            exc,
            exc_info=True,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to remove Slack integration.",
        )

