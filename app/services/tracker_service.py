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
from app.utils.url_utils import normalize_url

logger = get_logger(__name__)


class TrackerService:
    """Main orchestrator service for the rank tracking workflow."""

    def __init__(self, db: Optional[Session] = None, user_id: Optional[int] = None):
        """
        Initialize the tracker service with dependencies.
        
        Args:
            db: Optional database session for saving results.
            user_id: Optional user ID tracking is scoped to.
        """
        self.search = SearchService()
        self.rank = RankingService()
        self.pagination = PaginationService()
        self.db = db
        self.user_id = user_id

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
                    competitors = []
                    if self.db:
                        db_app = RankingRepository.get_or_create_app(
                            self.db, app_name, app_url, self.user_id
                        )
                        if db_app:
                            competitors = db_app.competitors

                    targets = []
                    if db_app:
                        targets.append({"db_obj": db_app, "name": db_app.name, "url": db_app.url, "is_competitor": False})
                        for comp in competitors:
                            targets.append({"db_obj": comp, "name": comp.name, "url": comp.url, "is_competitor": True})
                    else:
                        targets.append({"db_obj": None, "name": app_name, "url": app_url, "is_competitor": False})

                    for keyword in app.keywords:
                        logger.info("Searching keyword: '%s'", keyword)

                        try:
                            self.search.search_keyword(page, keyword)
                        except Exception as e:
                            logger.exception(
                                "Skipping keyword '%s'",
                                keyword,
                            )
                            continue

                        results_map = {
                            normalize_url(t["url"]): {
                                "target": t,
                                "found": False,
                                "rank": None,
                                "page": None
                            } for t in targets
                        }

                        apps_seen_count = 0
                        current_page = 1

                        for current_page in range(1, MAX_PAGES + 1):
                            page_apps = self.rank.get_page_apps(page, keyword)
                            results_per_page = len(page_apps)

                            for idx, p_app in enumerate(page_apps):
                                current_rank = apps_seen_count + idx + 1
                                p_url_normalized = normalize_url(p_app["url"])

                                for target_url_norm, res_data in results_map.items():
                                    if res_data["found"]:
                                        continue

                                    if p_url_normalized == target_url_norm or p_app["name"].lower() == res_data["target"]["name"].lower():
                                        res_data["found"] = True
                                        res_data["rank"] = current_rank
                                        res_data["page"] = current_page
                                        logger.info(
                                            "Application '%s' found at overall rank %s (Page %s).",
                                            res_data["target"]["name"],
                                            current_rank,
                                            current_page,
                                        )

                            if all(r["found"] for r in results_map.values()):
                                logger.info("All target apps found. Stopping search pagination early.")
                                break

                            logger.info(
                                "Completed scanning page %s. Apps found: %s/%s",
                                current_page,
                                sum(1 for r in results_map.values() if r["found"]),
                                len(results_map)
                            )

                            if not self.pagination.next_page(page):
                                break
                            
                            apps_seen_count += results_per_page
                            current_page += 1

                        for res_data in results_map.values():
                            target = res_data["target"]
                            found = res_data["found"]
                            rank_val = res_data["rank"]
                            page_val = res_data["page"]

                            if not found:
                                logger.warning(
                                    "Application '%s' not found for keyword '%s'.",
                                    target["name"],
                                    keyword,
                                )

                            if self.db and target["db_obj"]:
                                db_keyword = RankingRepository.get_or_create_keyword(
                                    self.db, keyword
                                )
                                try:
                                    RankingRepository.add_keyword_to_app(self.db, target["db_obj"], db_keyword)
                                except Exception as e:
                                    logger.exception(f"Failed to associate keyword '{keyword}' with app '{target['name']}': {str(e)}")
                                
                                RankingRepository.save_ranking(
                                    self.db,
                                    app_id=target["db_obj"].id,
                                    keyword_id=db_keyword.id,
                                    rank=rank_val,
                                    page=page_val,
                                    found=found,
                                    screenshot_path=None,
                                )

                            results.append(
                                {
                                    "app_name": target["name"],
                                    "app_url": target["url"],
                                    "keyword": keyword,
                                    "rank": rank_val,
                                    "page": page_val,
                                    "found": found,
                                    "screenshot": None,
                                    "is_competitor": target["is_competitor"]
                                }
                            )

                        time.sleep(2)

                    if self.db and db_app:
                        RankingRepository.update_last_synced(self.db, db_app)
                        
                return results

        except Exception as e:
            logger.exception(f"An unexpected error occurred while executing the application: {str(e)}")
            raise
