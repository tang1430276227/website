from models.agents import Agents
from services.base_service import BaseService


class AgentsService(BaseService):
    """Service layer for Agents operations."""
    model = Agents