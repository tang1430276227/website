from models.messages import Messages
from services.base_service import BaseService


class MessagesService(BaseService):
    """Service layer for Messages operations."""
    model = Messages