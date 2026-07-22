from models.tenants import Tenants
from services.base_service import BaseService


class TenantsService(BaseService):
    """Service layer for Tenants operations."""
    model = Tenants