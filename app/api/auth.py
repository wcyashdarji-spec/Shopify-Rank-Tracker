from sqlalchemy.orm import Session
from fastapi import APIRouter, Depends, HTTPException, status

from app.db import get_db
from app.db.models.user import User
from app.core.logger import get_logger
from app.api.auth_deps import get_current_user
from app.schemas.request import UserCreate, UserLogin, UserUpdate
from app.core.security import hash_password, verify_password, create_access_token

logger = get_logger(__name__)

router = APIRouter(
    prefix="/auth",
    tags=["Authentication"],
)

@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(request: UserCreate, db: Session = Depends(get_db)):
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
        new_user = User(email=email, hashed_password=hashed)
        
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
def login(request: UserLogin, db: Session = Depends(get_db)):
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
                detail="User not found",
                headers={"WWW-Authenticate": "Bearer"},
            )
            
        if not verify_password(password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect password",
                headers={"WWW-Authenticate": "Bearer"},
            )
            
        token = create_access_token(subject=user.id)
        
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


@router.get("/me")
def get_me(current_user: User = Depends(get_current_user)):
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
        "created_at": current_user.created_at.isoformat() if current_user.created_at else None,
    }


@router.put("/me")
def update_me(
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
