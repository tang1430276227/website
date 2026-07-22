from core.database import Base
from datetime import datetime
from sqlalchemy import Column, DateTime, Integer, String


class Workflows(Base):
    __tablename__ = "workflows"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True, nullable=False)
    user_id = Column(String, nullable=False)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    nodes = Column(String, nullable=True)
    edges = Column(String, nullable=True)
    config = Column(String, nullable=True)
    status = Column(String, nullable=True, default='draft', server_default='draft')
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)