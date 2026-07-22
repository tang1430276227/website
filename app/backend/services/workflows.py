from models.workflows import Workflows
from services.base_service import BaseService


class WorkflowsService(BaseService):
    """Service layer for Workflows operations."""
    model = Workflows