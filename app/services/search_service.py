from urllib.parse import quote
from playwright.sync_api import Page
from app.core.logger import get_logger
from app.constants.shopify import BASE_URL

logger = get_logger(__name__)


class SearchService:
    """Service for handling search operations in Shopify App Store."""

    @staticmethod
    def search_keyword(page: Page, keyword: str) -> None:
        """
        Open the Shopify App Store search page for a given keyword.

        Args:
            page: Active Playwright page instance.
            keyword: Keyword to search in the Shopify App Store.

        Raises:
            Exception: If the search page cannot be loaded.
        """
        try:
            url = f"{BASE_URL}?q={quote(keyword)}"

            logger.info("Searching Shopify App Store for keyword: '%s'", keyword)

            page.goto(url, wait_until="networkidle")

        except Exception as e:
            logger.exception(f"Failed to search for keyword '{keyword}': {str(e)}")
            raise
