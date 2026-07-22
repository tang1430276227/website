from models.conversations import Conversations
from services.base_service import BaseService


class ConversationsService(BaseService):
    """Service layer for Conversations operations."""
    model = Conversations