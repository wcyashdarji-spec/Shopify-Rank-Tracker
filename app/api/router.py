from fastapi import APIRouter

from app.api.auth import router as auth_router
from app.api.apps import router as apps_router
from app.api.tracker import router as tracker_router
from app.api.keywords import router as keywords_router
from app.api.rankings import router as rankings_router
from app.api.collaborators import router as collaborators_router

api_router = APIRouter()

api_router.include_router(auth_router)
api_router.include_router(tracker_router)
api_router.include_router(apps_router)
api_router.include_router(keywords_router)
api_router.include_router(rankings_router)
api_router.include_router(collaborators_router)
