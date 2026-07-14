from playwright.sync_api import Page
from app.core.logger import get_logger

logger = get_logger(__name__)


class PaginationService:
    """Service for handling pagination through search results."""

    @staticmethod
    def next_page(page: Page) -> bool:
        """
        Navigate to the next page of Shopify search results.

        Args:
            page: Active Playwright page instance.

        Returns:
            True if the next page was opened successfully, otherwise False.
        """
        try:
            next_btn = page.locator("a[rel='next']")

            if next_btn.count() == 0:
                logger.info("No additional search result pages found.")
                return False

            next_link = next_btn.first
            try:
                next_link.scroll_into_view_if_needed(timeout=12000)
                next_link.click(timeout=30000)
            except Exception as click_exc:
                logger.warning("Next button click failed, trying direct navigation: %s", click_exc)
                href = next_link.get_attribute("href")
                if not href:
                    logger.warning("Next button has no href attribute.")
                    return False
                page.goto(href, timeout=30000)

            page.wait_for_load_state("networkidle", timeout=30000)
            logger.info("Navigated to the next search results page.")
            return True

        except Exception as e:
            logger.exception(f"Failed to navigate to the next page: {str(e)}")
            return False
