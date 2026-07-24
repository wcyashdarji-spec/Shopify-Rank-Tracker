from typing import List, Optional
from pydantic import BaseModel, HttpUrl


class AppRequest(BaseModel):
    name: str
    url: HttpUrl
    keywords: List[str]


class TrackerRequest(BaseModel):
    apps: List[AppRequest]


class AppKeywordUpdateRequest(BaseModel):
    keywords: List[str]


class UserCreate(BaseModel):
    email: str
    password: str


class UserLogin(BaseModel):
    email: str
    password: str


class CompetitorCreateRequest(BaseModel):
    name: str
    url: HttpUrl


class UserUpdate(BaseModel):
    email: Optional[str] = None
    password: Optional[str] = None


class InviteCollaboratorRequest(BaseModel):
    email: str


