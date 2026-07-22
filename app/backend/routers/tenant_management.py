"""Tenant management router.

Provides endpoints for multi-tenant operations: create tenant,
manage members, and view tenant-level usage.
"""
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from dependencies.auth import get_current_user
from schemas.auth import UserResponse
from services.tenants import TenantsService
from services.tenant_members import Tenant_membersService
from services.billing_service import BillingService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/tenants", tags=["tenants"])


# ---------- Schemas ----------

class CreateTenantRequest(BaseModel):
    name: str
    slug: str
    plan: str = "free"
    max_tokens_per_month: int = 1000000


class AddMemberRequest(BaseModel):
    user_id: str
    role: str = "member"


# ---------- Routes ----------

@router.post("/")
async def create_tenant(
    data: CreateTenantRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new tenant organization."""
    tenant_service = TenantsService(db)
    member_service = Tenant_membersService(db)
    user_id = str(current_user.id)

    tenant = await tenant_service.create({
        "name": data.name,
        "slug": data.slug,
        "owner_user_id": user_id,
        "plan": data.plan,
        "max_tokens_per_month": data.max_tokens_per_month,
        "is_active": True,
    })

    # Auto-add creator as admin
    await member_service.create({
        "tenant_id": tenant.id,
        "user_id": user_id,
        "role": "admin",
    })

    return {"id": tenant.id, "name": tenant.name, "slug": tenant.slug}


@router.get("/my")
async def get_my_tenants(
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get tenants the current user belongs to."""
    member_service = Tenant_membersService(db)
    memberships = await member_service.list_by_field("user_id", str(current_user.id), limit=50)
    tenant_service = TenantsService(db)
    tenants = []
    for m in memberships:
        t = await tenant_service.get_by_id(m.tenant_id)
        if t:
            tenants.append({"id": t.id, "name": t.name, "slug": t.slug, "role": m.role, "plan": t.plan})
    return {"tenants": tenants}


@router.post("/{tenant_id}/members")
async def add_member(
    tenant_id: int,
    data: AddMemberRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Add a member to a tenant (admin only)."""
    member_service = Tenant_membersService(db)
    # Verify caller is admin
    caller_memberships = await member_service.list_by_field("user_id", str(current_user.id), limit=50)
    is_admin = any(m.tenant_id == tenant_id and m.role == "admin" for m in caller_memberships)
    if not is_admin:
        raise HTTPException(status_code=403, detail="Only tenant admins can add members")

    member = await member_service.create({
        "tenant_id": tenant_id,
        "user_id": data.user_id,
        "role": data.role,
    })
    return {"id": member.id, "tenant_id": tenant_id, "user_id": data.user_id, "role": data.role}


@router.get("/{tenant_id}/usage")
async def get_tenant_usage(
    tenant_id: int,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get usage stats for a tenant."""
    billing = BillingService(db)
    # Verify membership
    member_service = Tenant_membersService(db)
    memberships = await member_service.list_by_field("user_id", str(current_user.id), limit=50)
    is_member = any(m.tenant_id == tenant_id for m in memberships)
    if not is_member:
        raise HTTPException(status_code=403, detail="Not a member of this tenant")

    quota = await billing.check_quota(str(current_user.id), tenant_id)
    return quota