from typing import Optional, Tuple
from urllib.parse import urlparse
from playwright.sync_api import Page
from app.core.logger import get_logger
from app.utils.url_utils import is_app_url, normalize_url

logger = get_logger(__name__)


class RankingService:
    """Service for finding and determining application rank on search results."""

    @staticmethod
    def find_app(
        page: Page, keyword: str, app_name: str, app_url: str
    ) -> Tuple[Optional[int], bool, Optional[object]]:
        """
        Search the current Shopify App Store results page for the configured app.

        Args:
            page: Active Playwright page instance.
            keyword: Keyword being searched.
            app_name: Name of the application to find.
            app_url: URL of the application to find.

        Returns:
            A tuple containing:
                - The rank of the application if found, otherwise None.
                - True if the application is found, otherwise False.
                - The matched element (Locator/ElementHandle) when found, else None.

        Raises:
            Exception: If an unexpected error occurs while parsing the page.
        """
        try:
            target_url = normalize_url(app_url)
            links = page.locator("a[href]").all()

            unique_urls: set[str] = set()
            rank = 1

            for link in links:
                href = link.get_attribute("href")

                if not href:
                    continue

                full_url = (
                    f"https://apps.shopify.com{href}"
                    if href.startswith("/")
                    else href
                )

                full_url = normalize_url(full_url)
                parsed = urlparse(full_url)

                if not is_app_url(parsed.path, parsed.netloc):
                    continue

                if full_url in unique_urls:
                    continue

                unique_urls.add(full_url)

                try:
                    text = link.inner_text().strip()
                except Exception as e:
                    logger.debug(
                        "Unable to retrieve link text for URL: %s",
                        full_url,
                        e
                    )
                    text = ""

                logger.info(
                    "[%-20s] Rank: %-3d | %-50s | %s",
                    keyword,
                    rank,
                    text if text else "<No Title>",
                    full_url,
                )

                if full_url == target_url:
                    logger.info("Application found at rank %s.", rank)
                    return rank, True, link

                if text.lower() == app_name.lower():
                    logger.info("Application found at rank %s.", rank)
                    return rank, True, link

                rank += 1

            return None, False, None

        except Exception as e:
            logger.exception(f"Failed to find app '{app_name}' for keyword '{keyword}': {str(e)}")
            raise
