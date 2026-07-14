from app.core.logger import get_logger
from playwright.sync_api import sync_playwright

logger = get_logger(__name__)


class BrowserManager:
    """Manager for Playwright browser lifecycle."""

    def __init__(self, headless: bool = True):
        """
        Initialize the browser manager.

        Args:
            headless: Whether to run browser in headless mode.
        """
        self.headless = headless
        self.playwright = None
        self.browser = None
        self.page = None

    def __enter__(self):
        """Start the browser and return the page."""
        try:
            self.playwright = sync_playwright().start()
            self.browser = self.playwright.chromium.launch(headless=self.headless)
            self.page = self.browser.new_page()


            self.page.set_default_timeout(60000)

            self.page.set_default_navigation_timeout(60000)

            logger.info("Browser started successfully.")
            return self.page

        except Exception as e:
            logger.exception(f"Failed to start browser: {str(e)}")
            raise

    def __exit__(self, *args):
        """Close the browser."""
        try:
            if self.browser:
                self.browser.close()

            if self.playwright:
                self.playwright.stop()

            logger.info("Browser closed successfully.")

        except Exception as e:
            logger.exception(f"Failed to close browser: {str(e)}")
            raise
