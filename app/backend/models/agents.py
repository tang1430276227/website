from core.database import Base
from datetime import datetime
from sqlalchemy import Boolean, Column, DateTime, Integer, String


class Agents(Base):
    __tablename__ = "agents"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True, nullable=False)
    user_id = Column(String, nullable=False)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    system_prompt = Column(String, nullable=True)
    code = Column(String, nullable=True)
    model = Column(String, nullable=True)
    config = Column(String, nullable=True)
    is_public = Column(Boolean, nullable=True, default=False, server_default='false')
    status = Column(String, nullable=True, default='draft', server_default='draft')
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)