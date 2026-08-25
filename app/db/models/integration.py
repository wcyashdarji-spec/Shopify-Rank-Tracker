from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.db import Base


class SlackIntegration(Base):
    """Model for storing user Slack workspace integration configurations."""

    __tablename__ = "slack_integrations"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    workspace_name = Column(String(255), nullable=False)
    webhook_url = Column(String(500), nullable=True)
    bot_token = Column(String(500), nullable=True)
    channel_name = Column(String(100), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", backref="slack_integrations")

    def __repr__(self):
        return f"<SlackIntegration(id={self.id}, workspace_name={self.workspace_name}, is_active={self.is_active})>"
