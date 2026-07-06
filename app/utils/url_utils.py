import re
from urllib.parse import urlparse
from app.core.logger import get_logger
from app.constants.shopify import RESERVED_SLUGS

logger = get_logger(__name__)

APP_URL_RE = re.compile(r"^/[a-z0-9][a-z0-9\-]*$")


def is_app_url(parsed_path: str, netloc: str) -> bool:
    """
    Validate whether the given URL belongs to a Shopify app listing.

    Args:
        parsed_path: Path component of the URL.
        netloc: Network location (domain) of the URL.

    Returns:
        True if the URL represents a valid Shopify app listing,
        otherwise False.
    """
    try:
        if netloc != "apps.shopify.com":
            return False

        if not APP_URL_RE.match(parsed_path):
            return False

        slug = parsed_path.strip("/").lower()

        if slug in RESERVED_SLUGS:
            return False

        return True

    except Exception as e:
        logger.exception(f"Error validating app URL with path '{parsed_path}' and netloc '{netloc}': {str(e)}")
        return False


def normalize_url(url: str) -> str:
    """
    Normalize a URL by removing query parameters and converting it
    to lowercase.

    Args:
        url: URL to normalize.

    Returns:
        Normalized URL without query parameters.

    Raises:
        ValueError: If the URL is invalid.
    """
    try:
        parsed = urlparse(url)
        return f"{parsed.scheme}://{parsed.netloc}{parsed.path}".lower()

    except Exception as exc:
        logger.exception(f"Failed to normalize URL '{url}': {str(exc)}")
        raise ValueError(f"Invalid URL: {url}") from exc
