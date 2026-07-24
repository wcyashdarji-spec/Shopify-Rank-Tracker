from sqlalchemy.orm import Session
from fastapi import APIRouter, Depends, HTTPException, status

from app.db import get_db
from app.db.models.user import User
from app.core.logger import get_logger
from app.schemas.request import UserCreate, UserLogin
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
        if not user or not verify_password(password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password",
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
