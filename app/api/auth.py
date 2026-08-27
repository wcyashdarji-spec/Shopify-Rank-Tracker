import time
import httpx
import secrets
import requests
from html import escape
from datetime import datetime
from sqlalchemy.orm import Session
from urllib.parse import quote, urlencode
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.db import get_db
from app.core.logger import get_logger
from app.api.auth_deps import get_current_user
from app.core.logging_route import LoggingRoute
from app.db.models.user import User, UserActivity
from fastapi.responses import HTMLResponse, RedirectResponse
from app.core.security import hash_password, verify_password, create_access_token
from app.core.config import GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI
from app.schemas.request import UserCreate, UserLogin, UserUpdate, GoogleOAuthCallbackRequest

logger = get_logger(__name__)

_google_state_store: dict[str, float] = {}

_auth_code_store: dict[str, tuple[str, float]] = {}


def _issue_google_state() -> str:
    """Generate and store a short-lived CSRF state token for Google OAuth."""
    state = secrets.token_urlsafe(32)
    _google_state_store[state] = time.time() + 600
    return state


def _validate_google_state(state: str | None) -> bool:
    """Return True and consume the state token if valid; False otherwise."""
    if not state:
        return False
    expires_at = _google_state_store.pop(state, None)
    return expires_at is not None and time.time() < expires_at


def _issue_auth_code(jwt_token: str) -> str:
    """Wrap a JWT in a short-lived one-time code for the redirect URL."""
    code = secrets.token_urlsafe(32)
    _auth_code_store[code] = (jwt_token, time.time() + 120)
    return code


router = APIRouter(
    prefix="/auth",
    tags=["Authentication"],
    route_class=LoggingRoute,
)

@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(request: UserCreate, db: Session = Depends(get_db)):
    """
    Register a new user account.

    This endpoint validates the provided email and password, ensures that
    the email is not already registered, securely hashes the password,
    creates a new user record in the database, and returns the newly
    created user's basic information.

    Raises:
        HTTPException:
            - 400: If the email is already registered or required fields are missing.
            - 500: If an unexpected error occurs during registration.
    """
    try:
        email = request.email.strip().lower()
        password = request.password
        
        if not email or not password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email and password are required"
            )
            
        existing_user = db.query(User).filter(User.email == email).first()
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email is already registered"
            )
            
        hashed = hash_password(password)
        new_user = User(email=email, hashed_password=hashed, auth_provider="email")
        
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        
        logger.info(f"Successfully registered new user: {email}")
        
        return {
            "message": "User registered successfully. Please login.",
            "user": {
                "id": new_user.id,
                "email": new_user.email
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Failed to register user: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to register user"
        )


@router.post("/login")
async def login(request: UserLogin, db: Session = Depends(get_db)):
    """
    Authenticate an existing user and issue a JWT access token.

    This endpoint verifies the provided email and password against the
    stored user credentials. If authentication succeeds, a JWT bearer
    token is generated and returned along with the user's basic
    information for use in authenticated requests.

    Raises:
        HTTPException:
            - 401: If the email or password is invalid.
            - 500: If an unexpected error occurs during authentication.
    """
    try:
        email = request.email.strip().lower()
        password = request.password
        
        user = db.query(User).filter(User.email == email).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
            
        if not user.hashed_password:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="This account was created using Google Sign-In. Please sign in with Google.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        if not verify_password(password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
            
        token = create_access_token(subject=user.id)
        
        activity = UserActivity(user_id=user.id, login_at=datetime.utcnow())
        db.add(activity)
        db.commit()
        
        logger.info(f"User logged in: {email}")
        
        return {
            "access_token": token,
            "token_type": "bearer",
            "user": {
                "id": user.id,
                "email": user.email
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Failed to login user: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to authenticate user"
        )


@router.get("/google/url")
async def get_google_auth_url(redirect_uri: str = None):
    """
    Generate a Google OAuth 2.0 authorization URL.

    Builds a Google authorization URL using the configured OAuth client
    credentials and redirect URI. The generated URL requests OpenID, email,
    and profile scopes and prompts the user to select a Google account.

    Args:
        redirect_uri: Optional OAuth callback URI. When omitted, the
            configured GOOGLE_REDIRECT_URI is used.

    Returns:
        A dictionary containing the Google authorization URL, client ID,
        and redirect URI.

    Raises:
        HTTPException: If GOOGLE_CLIENT_ID is not configured or an unexpected
            error occurs while generating the authorization URL.
    """
    try:
        if not GOOGLE_CLIENT_ID:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="GOOGLE_CLIENT_ID is not configured on the server."
            )

        target_redirect = redirect_uri or GOOGLE_REDIRECT_URI
        state = _issue_google_state()
        params = {
            "client_id": GOOGLE_CLIENT_ID,
            "redirect_uri": target_redirect,
            "response_type": "code",
            "scope": "openid email profile",
            "prompt": "select_account",
            "state": state,
        }
        url = f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(params)}"
        return {
            "url": url,
            "client_id": GOOGLE_CLIENT_ID,
            "redirect_uri": target_redirect,
        }
    
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception(
            "[Google OAuth] Failed to generate authorization URL: %s",
            exc,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate Google OAuth authorization URL.",
        )

async def _process_google_code_exchange(code: str, target_redirect: str, db: Session):
    """
    Exchange a Google OAuth 2.0 authorization code and authenticate the user.

    Exchanges the authorization code for Google tokens, retrieves the
    authenticated user's profile, validates the returned email address,
    creates the user if necessary, generates an application access token,
    and records the login activity.

    Args:
        code: Google OAuth 2.0 authorization code.
        target_redirect: Redirect URI used during the Google authorization
            code exchange.
        db: Active database session.

    Returns:
        A tuple containing the application access token and authenticated user.

    Raises:
        HTTPException: If the authorization code is missing, Google OAuth
            credentials are unavailable, the token exchange fails, the user
            profile cannot be retrieved, or an unexpected processing error
            occurs.
    """
    try:
        if not code:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Authorization code is required"
            )

        if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Google OAuth client credentials are not configured on the server."
            )

        async with httpx.AsyncClient() as client:
            try:
                token_resp = await client.post(
                    "https://oauth2.googleapis.com/token",
                    data={
                        "code": code,
                        "client_id": GOOGLE_CLIENT_ID,
                        "client_secret": GOOGLE_CLIENT_SECRET,
                        "redirect_uri": target_redirect,
                        "grant_type": "authorization_code",
                    },
                    timeout=10.0,
                )
                if token_resp.status_code != 200:
                    logger.error(f"Google token exchange failed: {token_resp.text}")
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Google token exchange failed"
                    )

                token_data = token_resp.json()
                access_token = token_data.get("access_token")
                if not access_token:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="No access token returned by Google"
                    )

                userinfo_resp = await client.get(
                    "https://www.googleapis.com/oauth2/v3/userinfo",
                    headers={"Authorization": f"Bearer {access_token}"},
                    timeout=10.0,
                )
                if userinfo_resp.status_code != 200:
                    logger.error(f"Google userinfo fetch failed: {userinfo_resp.text}")
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Failed to fetch user profile from Google"
                    )

                userinfo = userinfo_resp.json()
                email = userinfo.get("email")
                if not email:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Google profile did not contain an email address"
                    )
                
                email = email.strip().lower()

            except httpx.RequestError as exc:
                logger.error(f"HTTP communication error with Google: {exc}")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to communicate with Google OAuth services"
                )

        user = db.query(User).filter(User.email == email).first()
        if not user:
            user = User(
                email=email,
                hashed_password=None,
                auth_provider="google"
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            logger.info(f"[OAuth2.0] Auto-registered new Google user: {email}")
        else:
            logger.info(f"[OAuth2.0] Existing user authenticated with Google: {email}")

        token = create_access_token(subject=user.id)
        
        activity = UserActivity(user_id=user.id, login_at=datetime.utcnow())
        db.add(activity)
        db.commit()
        db.refresh(activity)
        logger.info(f"Recorded UserActivity login entry (id={activity.id}) for user_id={user.id} ({user.email})")

        return token, user

    except HTTPException:
        raise
    except Exception as exc:
        logger.exception(
            "[Google OAuth] Unexpected code exchange error: %s",
            exc,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to process Google OAuth authorization.",
        )


@router.get("/google/callback")
async def google_oauth_callback_get(
    code: str = None,
    error: str = None,
    state: str = None,
    redirect_uri: str = None,
    db: Session = Depends(get_db)
):
    """
    Handle the Google OAuth 2.0 browser redirect callback.

    Validates the OAuth state parameter to protect against CSRF attacks,
    processes the authorization code returned by Google, authenticates or
    registers the user, and issues a short-lived one-time authentication code.

    The JWT access token is never exposed directly in the browser redirect URL.
    Instead, the token is stored behind a temporary one-time authentication code
    that is returned to the frontend.

    Args:
        code: Google OAuth 2.0 authorization code returned by Google.
        error: Optional OAuth error returned by Google.
        state: OAuth state value used to validate the authorization request.
        redirect_uri: Optional redirect URI used during the Google OAuth flow.
            Falls back to GOOGLE_REDIRECT_URI when not provided.
        db: Active database session used for user authentication and persistence.

    Returns:
        RedirectResponse: Redirects the authenticated browser to FRONTEND_URL
        with a short-lived one-time authentication code.

        HTMLResponse: Returns a user-friendly error page when Google returns
        an OAuth error or the state validation fails.

    Raises:
        HTTPException: If an unexpected error occurs while processing the
        Google OAuth callback.
    """
    try:
        from app.core.config import FRONTEND_URL
        if error:
            logger.error("Google OAuth redirect error: %s", error)
            return HTMLResponse(
                f"<h2>Google Sign-In Error</h2><p>{escape(str(error))}</p>"
                f"<a href='{escape(FRONTEND_URL)}'>Return to Login</a>",
                status_code=400
            )

        if not _validate_google_state(state):
            logger.warning("Google OAuth callback: invalid or missing state token.")
            return HTMLResponse(
                "<h2>Authentication Error</h2><p>Invalid or expired request. Please try signing in again.</p>",
                status_code=400
            )

        target_redirect = redirect_uri or GOOGLE_REDIRECT_URI
        token, user = await _process_google_code_exchange(code, target_redirect, db)

        auth_code = _issue_auth_code(token)
        return RedirectResponse(
            url=f"{FRONTEND_URL}?{urlencode({'auth_code': auth_code})}",
            status_code=307,
        )

    except HTTPException:
        raise
    except Exception as exc:
        logger.exception(
            "[Google OAuth] Unexpected GET callback error: %s",
            exc,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to process Google OAuth callback.",
        )

@router.post("/google/callback")
async def google_oauth_callback_post(request: GoogleOAuthCallbackRequest, db: Session = Depends(get_db)):
    """
    Handle Google OAuth 2.0 authorization code exchange through the API.

    Accepts the Google authorization code as a JSON request, exchanges it
    with Google, authenticates or registers the user, and returns the
    application access token together with basic user information.

    Args:
        request: Request containing the Google authorization code and optional
            redirect URI.
        db: Active database session.

    Returns:
        A dictionary containing the bearer access token and authenticated
        user's ID and email.

    Raises:
        HTTPException: If the authorization code exchange or authentication
            process fails.
    """
    try:
        target_redirect = request.redirect_uri or GOOGLE_REDIRECT_URI
        token, user = await _process_google_code_exchange(request.code, target_redirect, db)

        return {
            "access_token": token,
            "token_type": "bearer",
            "user": {
                "id": user.id,
                "email": user.email
            }
        }

    except HTTPException:
        raise
    except Exception as exc:
        logger.exception(
            "[Google OAuth] Unexpected POST callback error: %s",
            exc,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to process Google OAuth callback.",
        )


@router.get("/token/exchange")
async def exchange_auth_code(code: str = Query(...)):
    """
    Exchange a short-lived one-time auth code for a JWT access token.

    The frontend calls this immediately after the Google OAuth redirect
    to obtain the real JWT without it being exposed in browser history.

    Args:
        code: One-time code received via the ?auth_code= redirect parameter.

    Returns:
        JWT access token and token type.

    Raises:
        HTTPException 400: If the code is missing, invalid, or expired.
    """
    entry = _auth_code_store.pop(code, None)
    if not entry or time.time() > entry[1]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired authentication code.",
        )
    jwt_token, _ = entry
    return {"access_token": jwt_token, "token_type": "bearer"}


@router.get("/me")
async def get_me(current_user: User = Depends(get_current_user)):
    """
    Retrieve the authenticated user's profile information.

    This endpoint returns the basic details of the currently logged-in
    user, including their unique identifier, email address, and account
    creation timestamp. Authentication is required to access this
    endpoint.
    """
    return {
        "id": current_user.id,
        "email": current_user.email,
        "created_at": current_user.created_at.isoformat() + "Z" if current_user.created_at else None,
    }


@router.put("/me")
async def update_me(
    request: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Update the authenticated user's profile information.

    This endpoint allows the current user to update their email address
    and/or password. The email is validated for uniqueness before being
    saved, and any new password is securely hashed before updating the
    user record.

    Raises:
        HTTPException:
            - 400: If the provided email is already registered.
            - 500: If an unexpected error occurs while updating the profile.
    """
    try:
        if request.email:
            new_email = request.email.strip().lower()
            if new_email != current_user.email:
                existing_user = db.query(User).filter(User.email == new_email).first()
                if existing_user:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Email is already registered"
                    )
                current_user.email = new_email

        if request.password:
            current_user.hashed_password = hash_password(request.password)

        db.commit()
        db.refresh(current_user)

        logger.info(f"Updated user details for user: {current_user.email}")
        return {
            "message": "Profile updated successfully",
            "user": {
                "id": current_user.id,
                "email": current_user.email
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.exception(f"Failed to update profile: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update profile"
        )


@router.post("/logout")
async def logout(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Log out the authenticated user and record their logout time.

    This endpoint updates the user's most recent active session by
    setting the logout timestamp. If no active session record exists,
    a new logout activity entry is created to ensure the user's
    activity history remains consistent.

    Raises:
        HTTPException:
            - 500: If an unexpected error occurs while recording the
              user's logout activity.
    """
    try:
        activity = (
            db.query(UserActivity)
            .filter(UserActivity.user_id == current_user.id, UserActivity.logout_at == None)
            .order_by(UserActivity.login_at.desc())
            .first()
        )
        if activity:
            activity.logout_at = datetime.utcnow()
        else:
            activity = UserActivity(user_id=current_user.id, logout_at=datetime.utcnow())
            db.add(activity)
            
        db.commit()
        
        logger.info(f"User logged out: {current_user.email}")
        return {"message": "Logged out successfully"}
    
    except Exception as e:
        db.rollback()
        logger.exception(f"Failed to logout user: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to record logout activity"
        )

