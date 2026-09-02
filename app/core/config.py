import os
from dotenv import load_dotenv

load_dotenv()

HEADLESS = False

MAX_PAGES = 10

SCREENSHOT_FOLDER = "screenshots"

DATABASE_URL = os.getenv("DATABASE_URL")

SQLALCHEMY_DATABASE_URL = DATABASE_URL

REDIS_URL = os.getenv("REDIS_URL")

SLACK_BOT_TOKEN = os.getenv("SLACK_BOT_TOKEN")

DAILY_AUDIT_LIMIT_RAW = os.getenv("DAILY_AUDIT_LIMIT")

DAILY_AUDIT_LIMIT = None
if DAILY_AUDIT_LIMIT_RAW is not None and DAILY_AUDIT_LIMIT_RAW.strip() != "":
    try:
        DAILY_AUDIT_LIMIT = int(DAILY_AUDIT_LIMIT_RAW.strip())
    except ValueError:
        pass

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/")

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI", f"{FRONTEND_URL}/auth/google/callback")

