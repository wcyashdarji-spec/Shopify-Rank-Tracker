import os
from cryptography.fernet import Fernet, InvalidToken

from app.core.logger import get_logger

logger = get_logger(__name__)

_FERNET_KEY = os.getenv("FERNET_KEY")

if not _FERNET_KEY:
    raise RuntimeError(
        "FERNET_KEY environment variable is not set. "
        "Generate one with: python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\""
    )

_fernet = Fernet(_FERNET_KEY.encode())


def encrypt_token(plaintext: str | None) -> str | None:
    """Encrypt a plaintext token for storage in the database.

    Args:
        plaintext: The raw token string to encrypt, or None.

    Returns:
        A URL-safe base64-encoded ciphertext string, or None when the input
        is None or empty.
    """
    if not plaintext:
        return plaintext
    try:
        return _fernet.encrypt(plaintext.encode()).decode()
    except Exception as exc:
        logger.exception("Failed to encrypt token: %s", exc)
        raise


def decrypt_token(ciphertext: str | None) -> str | None:
    """Decrypt a previously encrypted token retrieved from the database.

    Args:
        ciphertext: The encrypted token string, or None.

    Returns:
        The original plaintext token string, or None when the input is None
        or empty.

    Raises:
        InvalidToken: If the ciphertext has been tampered with or is invalid.
    """
    if not ciphertext:
        return ciphertext
    try:
        return _fernet.decrypt(ciphertext.encode()).decode()
    except InvalidToken:
        logger.error("Token decryption failed: invalid or tampered ciphertext.")
        raise
    except Exception as exc:
        logger.exception("Unexpected error decrypting token: %s", exc)
        raise
