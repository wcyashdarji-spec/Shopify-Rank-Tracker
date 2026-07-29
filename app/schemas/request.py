from typing import List, Optional, Literal
from pydantic import BaseModel, HttpUrl, Field

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


class ChecklistItem(BaseModel):
    type: Literal["check_circle", "warning", "cancel", "info"] = Field(
        description="The type of signal icon: check_circle (pass), warning (needs attention), cancel (fail/missing), info (general advice)"
    )
    title: str = Field(description="Short title describing the check item")
    desc: str = Field(description="Detailed assessment text explaining the score, actual findings, or optimization recommendations")

class CategoryAudit(BaseModel):
    score: int = Field(ge=0, le=100, description="ASO score out of 100")
    subtext: str = Field(description="Brief summary string for layout subtext (e.g. '27/30 characters, 3 keywords detected.')")
    items: List[ChecklistItem] = Field(description="List of checked signal items for the category details checklist")

class AuditCategories(BaseModel):
    title_optimization: CategoryAudit = Field(description="Audit result for App Title length and keyword density")
    visual_assets: CategoryAudit = Field(description="Audit result for screenshots, alt text, and product videos")
    languages: CategoryAudit = Field(description="Audit result for internationalization support and target lang checks")
    technical_signals: CategoryAudit = Field(description="Audit result for privacy policies, badges, demo stores, and support tutorials")
    categories_discoverability: CategoryAudit = Field(description="Audit result for app store categories, tags, and integrations list")
    description_content: CategoryAudit = Field(description="Audit result for keywords, feature listings, and SEO metadata descriptions")

class AuditReport(BaseModel):
    overall_score: int = Field(ge=0, le=100, description="Weighted average or custom calculated overall optimization score")
    reviews_text: str = Field(description="Scraped reviews count string (e.g. '12 reviews', '0 reviews')")
    rating_val: float = Field(description="Scraped star rating numerical value (e.g. 4.8, 0.0)")
    categories: AuditCategories = Field(description="Scoring details across the 6 optimization categories")
    raw_integrations: List[str] = Field(description="Cleaned, verified list of actual third-party integrations and platforms (e.g., Klaviyo, Shopify Flow) the app works with, filtering out any rating, UI, or garbage elements.")
    raw_feature_tags: List[str] = Field(description="Cleaned, verified list of feature tags relevant to the app.")
    raw_pricing_plans: List[str] = Field(description="Cleaned, verified list of pricing plans.")
