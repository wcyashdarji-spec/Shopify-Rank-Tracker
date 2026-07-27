import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from app.db import init_db, engine
from app.core.logger import get_logger
from app.db.models.ranking import Base 
from app.db.models import User, App, Keyword, RankingHistory

logger = get_logger(__name__)


def main():
    """Initialize the database."""
    try:
        logger.info("=" * 80)
        logger.info("RANK TRACKER - DATABASE INITIALIZATION")
        logger.info("=" * 80)

        logger.info("\n[1/3] Testing database connection...")
        try:
            with engine.connect() as conn:
                conn.execute("SELECT 1")
            logger.info("✓ Database connection successful")
        except Exception as e:
            logger.info(f"✗ Database connection failed: {e}")
            logger.info("\nMake sure PostgreSQL is running and DATABASE_URL is set correctly.")
            logger.info("See DATABASE_SETUP.md for configuration instructions.")
            return False

        logger.info("\n[2/3] Creating database tables...")
        init_db()
        logger.info("✓ Database tables created successfully")

        logger.info("\n[3/3] Verifying tables...")
        inspector_sql = """
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public'
        """
        with engine.connect() as conn:
            result = conn.execute(inspector_sql)
            tables = [row[0] for row in result.fetchall()]

        expected_tables = {"apps", "keywords", "ranking_history", "users"}
        created_tables = set(tables)

        if expected_tables.issubset(created_tables):
            logger.info("✓ All tables verified:")
            for table in sorted(expected_tables):
                logger.info(f"  - {table}")
        else:
            missing = expected_tables - created_tables
            logger.info(f"✗ Missing tables: {missing}")
            return False

        logger.info("\n" + "=" * 80)
        logger.info("DATABASE INITIALIZATION COMPLETE!")
        logger.info("=" * 80)
        logger.info("\nYou can now start the application:")
        logger.info("  python -m uvicorn app.main:app --reload")
        logger.info("\nAPI Documentation:")
        logger.info("  http://localhost:8000/docs")
        logger.info("=" * 80)

        return True

    except Exception as e:
        logger.exception("Database initialization failed.")
        logger.info(f"\n✗ Error: {e}")
        return False


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
