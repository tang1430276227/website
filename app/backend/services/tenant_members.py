from models.tenant_members import Tenant_members
from services.base_service import BaseService


class Tenant_membersService(BaseService):
    """Service layer for Tenant_members operations."""
    model = Tenant_members