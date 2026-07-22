from core.database import Base
from datetime import datetime
from sqlalchemy import Column, DateTime, Integer, String


class Mcp_connections(Base):
    __tablename__ = "mcp_connections"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True, nullable=False)
    user_id = Column(String, nullable=False)
    mcp_tool_id = Column(Integer, nullable=False)
    status = Column(String, nullable=True, default='disconnected', server_default='disconnected')
    last_ping_at = Column(String, nullable=True)
    error_message = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)