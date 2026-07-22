from core.database import Base
from datetime import datetime
from sqlalchemy import Column, DateTime, Integer, String


class Agent_executions(Base):
    __tablename__ = "agent_executions"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True, nullable=False)
    user_id = Column(String, nullable=False)
    agent_id = Column(Integer, nullable=False)
    input_text = Column(String, nullable=False)
    output_text = Column(String, nullable=True)
    status = Column(String, nullable=True, default='pending', server_default='pending')
    error_message = Column(String, nullable=True)
    execution_time_ms = Column(Integer, nullable=True, default=0, server_default='0')
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)