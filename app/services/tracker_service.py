import time
from typing import Optional
from sqlalchemy.orm import Session
from app.core.config import MAX_PAGES
from app.core.logger import get_logger
from app.services.browser import BrowserManager
from app.utils.screenshot import ScreenshotUtil
from app.services.search_service import SearchService
from app.services.ranking_service import RankingService
from app.services.pagination_service import PaginationService
from app.db.repositories.ranking_repository import RankingRepository

logger = get_logger(__name__)


class TrackerService:
    """Main orchestrator service for the rank tracking workflow."""

    def __init__(self, db: Optional[Session] = None):
        """
        Initialize the tracker service with dependencies.
        
        Args:
            db: Optional database session for saving results.
        """
        self.search = SearchService()
        self.rank = RankingService()
        self.pagination = PaginationService()
        self.db = db

    def run(self, apps):
        """
        Execute the Shopify App Store rank search for all configured keywords.

        For each keyword, the script searches the Shopify App Store, determines
        the application's ranking, captures a screenshot if found, and logs
        the results.

        Args:
            apps: List of AppRequest objects containing app details and keywords.

        Returns:
            List of tracking results for each app and keyword combination.
        """
        try:
            with BrowserManager(headless=True) as page:
                results = []
                for app in apps:
                    app_name = app.name
                    app_url = str(app.url)

                    logger.info("=" * 80)
                    logger.info("Tracking App: %s", app_name)

                    db_app = None
                    if self.db:
                        db_app = RankingRepository.get_or_create_app(
                            self.db, app_name, app_url
                        )

                    for keyword in app.keywords:
                        logger.info("Searching keyword: '%s'", keyword)

                        self.search.search_keyword(page, keyword)

                        overall_rank = 1
                        found = False
                        screenshot_path = None

                        for current_page in range(1, MAX_PAGES + 1):
                            rank, status, _ = self.rank.find_app(
                                page=page,
                                keyword=keyword,
                                app_name=app_name,
                                app_url=app_url,
                            )

                            if status:
                                overall_rank += (rank - 1)

                                logger.info(
                                    "Application found at overall rank %s (Page %s).",
                                    overall_rank,
                                    current_page,
                                )

                                # screenshot_path = ScreenshotUtil.save(page, app_name, keyword)

                                found = True
                                break

                            logger.info(
                                "Application not found on page %s.",
                                current_page,
                            )

                            if not self.pagination.next_page(page):
                                break

                            overall_rank += 24

                        if not found:
                            logger.warning(
                                "Application '%s' not found for keyword '%s'.",
                                app_name,
                                keyword,
                            )

                        if self.db and db_app:
                            db_keyword = RankingRepository.get_or_create_keyword(
                                self.db, keyword
                            )
                            try:
                                RankingRepository.add_keyword_to_app(self.db, db_app, db_keyword)
                            except Exception as e:
                                logger.exception(f"Failed to associate keyword '{keyword}' with app '{app_name}': {str(e)}")
                            RankingRepository.save_ranking(
                                self.db,
                                app_id=db_app.id,
                                keyword_id=db_keyword.id,
                                rank=overall_rank if found else None,
                                page=current_page if found else None,
                                found=found,
                                screenshot_path=str(screenshot_path) if screenshot_path else None,
                            )

                        results.append(
                            {
                                "app_name": app_name,
                                "app_url": app_url,
                                "keyword": keyword,
                                "rank": overall_rank if found else None,
                                "page": current_page if found else None,
                                "found": found,
                                "screenshot": str(screenshot_path) if screenshot_path else None,
                            }
                        )
                        time.sleep(2)

                    if self.db and db_app:
                        RankingRepository.update_last_synced(self.db, db_app)
                        
                return results

        except Exception as e:
            logger.exception(f"An unexpected error occurred while executing the application: {str(e)}")
            raise
