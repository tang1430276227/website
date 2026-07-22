from models.usage_records import Usage_records
from services.base_service import BaseService


class Usage_recordsService(BaseService):
    """Service layer for Usage_records operations."""
    model = Usage_records