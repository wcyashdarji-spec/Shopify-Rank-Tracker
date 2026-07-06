from typing import List
from pydantic import BaseModel, HttpUrl


class AppRequest(BaseModel):
    name: str
    url: HttpUrl
    keywords: List[str]


class TrackerRequest(BaseModel):
    apps: List[AppRequest]


class AppKeywordUpdateRequest(BaseModel):
    keywords: List[str]
