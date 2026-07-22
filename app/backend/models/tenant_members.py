from core.database import Base
from datetime import datetime
from sqlalchemy import Column, DateTime, Integer, String


class Tenant_members(Base):
    __tablename__ = "tenant_members"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True, nullable=False)
    tenant_id = Column(Integer, nullable=False)
    role = Column(String, nullable=True, default='member', server_default='member')
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)