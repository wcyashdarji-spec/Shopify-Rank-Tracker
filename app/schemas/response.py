from typing import List, Optional
from pydantic import BaseModel


class TrackingResult(BaseModel):
    app_name: str
    app_url: str
    keyword: str
    rank: Optional[int]
    page: Optional[int]
    found: bool
    screenshot: Optional[str]


class TrackerResponse(BaseModel):
    message: str
    results: List[TrackingResult]
