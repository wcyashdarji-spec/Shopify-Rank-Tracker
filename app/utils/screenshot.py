from pathlib import Path
from app.core.logger import get_logger

logger = get_logger(__name__)


class ScreenshotUtil:
    """Utility for handling screenshot operations."""

    @staticmethod
    def save(page, app_name: str, keyword: str) -> Path:
        """
        Save a full-page screenshot from the current page.

        Args:
            page: Active Playwright page instance.
            app_name: Name of the application.
            keyword: Keyword that was searched.

        Returns:
            Path to the saved full-page screenshot.
        """
        try:
            screenshot_dir = Path("screenshots")
            screenshot_dir.mkdir(exist_ok=True)

            safe_app = app_name.replace(":", "").replace(" ", "_")

            full_path = screenshot_dir / f"{safe_app}_{keyword.replace(' ', '_')}_full.png"
            try:
                page.screenshot(path=str(full_path), full_page=True)
                logger.info("Full page screenshot saved to %s", full_path)
            except TypeError:
                page.screenshot(path=str(full_path))
                logger.info("Full page (viewport) screenshot saved to %s", full_path)

            return full_path

        except Exception as e:
            logger.exception(
                f"Failed to save screenshot for app '{app_name}' and keyword '{keyword}': {str(e)}"
            )
            raise
