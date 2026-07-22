from core.database import Base
from datetime import datetime
from sqlalchemy import Column, DateTime, Float, Integer, String


class Usage_records(Base):
    __tablename__ = "usage_records"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True, nullable=False)
    tenant_id = Column(Integer, nullable=True)
    conversation_id = Column(Integer, nullable=True)
    model = Column(String, nullable=False)
    provider = Column(String, nullable=True)
    prompt_tokens = Column(Integer, nullable=True, default=0, server_default='0')
    completion_tokens = Column(Integer, nullable=True, default=0, server_default='0')
    total_tokens = Column(Integer, nullable=True, default=0, server_default='0')
    cost_credits = Column(Float, nullable=True, default=0, server_default='0')
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)