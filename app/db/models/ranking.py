from datetime import datetime
from sqlalchemy.orm import relationship
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Table
from app.db import Base

app_keywords = Table(
    "app_keywords",
    Base.metadata,
    Column("app_id", Integer, ForeignKey("apps.id", ondelete="CASCADE"), primary_key=True),
    Column("keyword_id", Integer, ForeignKey("keywords.id", ondelete="CASCADE"), primary_key=True),
)


class App(Base):
    """Model for storing app information."""

    __tablename__ = "apps"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    url = Column(String(500), nullable=False, unique=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    rankings = relationship("RankingHistory", back_populates="app", cascade="all, delete-orphan")
    keywords = relationship(
        "Keyword",
        secondary=app_keywords,
        back_populates="apps",
        cascade="save-update",
    )

    def __repr__(self):
        return f"<App(id={self.id}, name={self.name})>"


class Keyword(Base):
    """Model for storing keywords."""

    __tablename__ = "keywords"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, unique=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    rankings = relationship("RankingHistory", back_populates="keyword", cascade="all, delete-orphan")
    apps = relationship(
        "App",
        secondary=app_keywords,
        back_populates="keywords",
        cascade="save-update",
    )

    def __repr__(self):
        return f"<Keyword(id={self.id}, name={self.name})>"


class RankingHistory(Base):
    """Model for storing daily app ranking history."""

    __tablename__ = "ranking_history"

    id = Column(Integer, primary_key=True, index=True)
    app_id = Column(Integer, ForeignKey("apps.id"), nullable=False, index=True)
    keyword_id = Column(Integer, ForeignKey("keywords.id"), nullable=False, index=True)
    rank = Column(Integer, nullable=True)
    page = Column(Integer, nullable=True)
    found = Column(Boolean, default=False, nullable=False)
    screenshot_path = Column(String(500), nullable=True)
    tracked_date = Column(DateTime, default=datetime.utcnow, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    app = relationship("App", back_populates="rankings")
    keyword = relationship("Keyword", back_populates="rankings")

    def __repr__(self):
        return f"<RankingHistory(app_id={self.app_id}, keyword_id={self.keyword_id}, rank={self.rank})>"
