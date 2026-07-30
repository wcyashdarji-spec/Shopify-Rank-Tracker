from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.db import Base

class User(Base):
    """Model for storing user authentication information."""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    apps = relationship("App", back_populates="user", cascade="all, delete-orphan")
    shared_apps = relationship("App", secondary="app_collaborators", back_populates="collaborators")
    activities = relationship("UserActivity", back_populates="user", cascade="all, delete-orphan")


class UserActivity(Base):
    """Model for tracking user login and logout activity."""
    __tablename__ = "user_activities"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    login_at = Column(DateTime, default=datetime.utcnow, nullable=True)
    logout_at = Column(DateTime, nullable=True)

    user = relationship("User", back_populates="activities")

    def __repr__(self):
        return f"<UserActivity(id={self.id}, user_id={self.user_id}, login_at={self.login_at}, logout_at={self.logout_at})>"


