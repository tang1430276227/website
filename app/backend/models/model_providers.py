from core.database import Base
from datetime import datetime
from sqlalchemy import Boolean, Column, DateTime, Integer, String


class Model_providers(Base):
    __tablename__ = "model_providers"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True, nullable=False)
    name = Column(String, nullable=False)
    api_type = Column(String, nullable=False)
    base_url = Column(String, nullable=False)
    api_key_encrypted = Column(String, nullable=True)
    models = Column(String, nullable=True)
    is_active = Column(Boolean, nullable=True, default=True, server_default='true')
    config = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)