import hashlib
import os
import jwt
from datetime import datetime, timedelta
from typing import Union, Any
from dotenv import load_dotenv

load_dotenv()

ALGORITHM = os.getenv("JWT_ALGORITHM")

SECRET_KEY = os.getenv("JWT_SECRET_KEY")

ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES"))

def hash_password(password: str) -> str:
    """Hash password using PBKDF2-SHA256 with a unique salt."""
    salt = os.urandom(16)
    hash_bytes = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, 100000)
    return f"{salt.hex()}:{hash_bytes.hex()}"

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password by checking its hash against stored hash."""
    try:
        salt_hex, hash_hex = hashed_password.split(':')
        salt = bytes.fromhex(salt_hex)
        hash_bytes = bytes.fromhex(hash_hex)
        new_hash = hashlib.pbkdf2_hmac('sha256', plain_password.encode('utf-8'), salt, 100000)
        return new_hash == hash_bytes
    except Exception:
        return False

def create_access_token(subject: Union[str, Any], expires_delta: timedelta = None) -> str:
    """Create a signed JWT access token."""
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode = {"exp": expire, "sub": str(subject)}
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def decode_access_token(token: str) -> str:
    """Decode JWT token and return the user ID (subject), or raise jwt.PyJWTError if invalid."""
    decoded_token = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    return decoded_token["sub"]

