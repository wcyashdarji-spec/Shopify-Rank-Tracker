from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime
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
