import os

import jwt
from sqlalchemy.orm import Session
from fastapi import HTTPException, Header, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.db import get_db
from app.db.models.user import User
from app.core.security import decode_access_token

security = HTTPBearer()

CRON_SECRET = os.getenv("CRON_SECRET_KEY")

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    """
    Get the currently logged-in user from the JWT token in the Authorization header.
    
    Args:
        credentials: The HTTPBearer credentials.
        db: Database session.
        
    Returns:
        The authenticated User model instance.
    """
    token = credentials.credentials
    try:
        user_id = decode_access_token(token)
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired as well session expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    return user


def verify_cron_key(x_cron_key: str = Header(...)):
    """
    Validate the X-Cron-Key header against the CRON_SECRET_KEY environment variable.

    This dependency should be added to all cron-triggered endpoints to prevent
    unauthenticated access.

    Raises:
        HTTPException: 403 if the key is missing, incorrect, or not configured.
    """
    if not CRON_SECRET or x_cron_key != CRON_SECRET:
        raise HTTPException(status_code=403, detail="Invalid cron key")
