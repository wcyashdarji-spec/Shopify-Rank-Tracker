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
    ) -> Tuple[Optional[int], bool, Optional[object], int] :
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


                excluded_apps = {
                    "https://apps.shopify.com/sitemap",
                }

                if not is_app_url(parsed.path, parsed.netloc):
                    continue

                if full_url in excluded_apps:
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
                    return rank, True, link, len(unique_urls)

                if text.lower() == app_name.lower():
                    logger.info("Application found at rank %s.", rank)
                    return rank, True, link, len(unique_urls)

                rank += 1

            return None, False, None, len(unique_urls)

        except Exception as e:
            logger.exception(f"Failed to find app '{app_name}' for keyword '{keyword}': {str(e)}")
            raise

    @staticmethod
    def get_page_apps(page: Page, keyword: str) -> list[dict]:
        """
        Extract all unique Shopify app listings from the current search results page.

        This method scans every hyperlink on the page, filters out non-app
        URLs and excluded links, normalizes valid Shopify app URLs, and
        returns a list of unique applications in the order they appear.
        Each result contains the application's URL and display name.

        Raises:
            Exception:
                Propagates any errors encountered while parsing the page
                or extracting application details.
        """
        try:
            links = page.locator("a[href]").all()
            unique_apps = []
            unique_urls = set()

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

                excluded_apps = {
                    "https://apps.shopify.com/sitemap",
                }

                if not is_app_url(parsed.path, parsed.netloc):
                    continue

                if full_url in excluded_apps or full_url in unique_urls:
                    continue

                unique_urls.add(full_url)

                try:
                    text = link.inner_text().strip()
                except Exception:
                    text = ""

                unique_apps.append({
                    "url": full_url,
                    "name": text,
                })

            return unique_apps

        except Exception as e:
            logger.exception(f"Failed to get page apps for keyword '{keyword}': {str(e)}")
            raise
