import os
from dotenv import load_dotenv

load_dotenv()

HEADLESS = False

MAX_PAGES = 10

SCREENSHOT_FOLDER = "screenshots"

DATABASE_URL = os.getenv("DATABASE_URL")

SQLALCHEMY_DATABASE_URL = DATABASE_URL

DAILY_AUDIT_LIMIT_RAW = os.getenv("DAILY_AUDIT_LIMIT")

DAILY_AUDIT_LIMIT = None
if DAILY_AUDIT_LIMIT_RAW is not None and DAILY_AUDIT_LIMIT_RAW.strip() != "":
    try:
        DAILY_AUDIT_LIMIT = int(DAILY_AUDIT_LIMIT_RAW.strip())
    except ValueError:
        pass

