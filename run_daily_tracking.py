from app.db.database_config import SessionLocal
from app.db.repositories.ranking_repository import RankingRepository
from app.services.tracker_service import TrackerService
from app.core.logger import get_logger

logger = get_logger(__name__)


def _build_apps_payload(db):
    apps = RankingRepository.get_all_apps(db)
    payload = []
    for app in apps:
        keywords = [keyword.name for keyword in app.keywords]
        if keywords:
            payload.append({"name": app.name, "url": app.url, "keywords": keywords})
        else:
            logger.info("Skipping app '%s' because it has no keywords.", app.name)
    return payload


def main():
    db = SessionLocal()
    try:
        apps_payload = _build_apps_payload(db)
        if not apps_payload:
            logger.info("No apps with keywords found. Nothing to run.")
            return

        logger.info("Running daily tracker for %s apps.", len(apps_payload))
        tracker = TrackerService(db=db)
        results = tracker.run(apps_payload)
        logger.info("Daily tracker finished. Results: %s", results)
    except Exception as e:
        logger.exception("Daily tracker execution failed: %s", str(e))
    finally:
        db.close()


if __name__ == "__main__":
    main()
