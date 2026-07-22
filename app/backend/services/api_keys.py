from models.api_keys import Api_keys
from services.base_service import BaseService


class Api_keysService(BaseService):
    """Service layer for Api_keys operations."""
    model = Api_keys