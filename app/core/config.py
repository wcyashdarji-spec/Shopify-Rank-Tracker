import os
from dotenv import load_dotenv

load_dotenv()

HEADLESS = False

MAX_PAGES = 5

SCREENSHOT_FOLDER = "screenshots"

DATABASE_URL = os.getenv("DATABASE_URL")

SQLALCHEMY_DATABASE_URL = DATABASE_URL
