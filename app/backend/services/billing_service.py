"""Billing and usage tracking service.

Tracks token consumption per user/tenant, enforces quotas,
and calculates cost credits using a model pricing map.
"""
import logging
from typing import Any, Dict, Optional

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from models.usage_records import Usage_records
from models.tenants import Tenants
from models.tenant_members import Tenant_members
from services.usage_records import Usage_recordsService

logger = logging.getLogger(__name__)


# ---------- Model Pricing Map (credits per 1K tokens) ----------

MODEL_PRICING: Dict[str, Dict[str, float]] = {
    "deepseek-v4-pro": {"prompt": 0.1, "completion": 0.3},
    "gpt-5.4": {"prompt": 2.5, "completion": 10.0},
    "claude-opus-4.6": {"prompt": 3.0, "completion": 15.0},
    "gemini-2.5-pro": {"prompt": 1.25, "completion": 5.0},
    "gemini-3.1-pro-preview": {"prompt": 1.25, "completion": 5.0},
    "gpt-4": {"prompt": 3.0, "completion": 6.0},
    "gpt-3.5-turbo": {"prompt": 0.05, "completion": 0.15},
    "glm-4": {"prompt": 0.5, "completion": 0.5},
    "qwen-max": {"prompt": 0.8, "completion": 0.8},
}

DEFAULT_PRICING = {"prompt": 1.0, "completion": 2.0}


# ---------- Helpers ----------

def calculate_cost(model: str, prompt_tokens: int, completion_tokens: int) -> float:
    """Calculate cost in credits based on model pricing map."""
    pricing = MODEL_PRICING.get(model, DEFAULT_PRICING)
    prompt_cost = (prompt_tokens / 1000.0) * pricing["prompt"]
    completion_cost = (completion_tokens / 1000.0) * pricing["completion"]
    return round(prompt_cost + completion_cost, 6)


# ---------- Main Service ----------

class BillingService:
    """Manages usage tracking and quota enforcement."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self._usage_service = Usage_recordsService(db)

    async def record_usage(
        self, user_id: str, model: str, provider: str,
        prompt_tokens: int, completion_tokens: int,
        conversation_id: Optional[int] = None,
        tenant_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Record a usage event and return cost summary."""
        total_tokens = prompt_tokens + completion_tokens
        cost = calculate_cost(model, prompt_tokens, completion_tokens)
        record = await self._usage_service.create({
            "user_id": user_id,
            "tenant_id": tenant_id,
            "conversation_id": conversation_id,
            "model": model,
            "provider": provider,
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "total_tokens": total_tokens,
            "cost_credits": cost,
        })
        return {"id": record.id, "total_tokens": total_tokens, "cost_credits": cost}

    async def get_user_usage_summary(self, user_id: str) -> Dict[str, Any]:
        """Get aggregated usage stats for a user."""
        query = select(
            func.sum(Usage_records.total_tokens).label("total_tokens"),
            func.sum(Usage_records.cost_credits).label("total_cost"),
            func.count(Usage_records.id).label("request_count"),
        ).where(Usage_records.user_id == user_id)
        result = await self.db.execute(query)
        row = result.one_or_none()
        if not row:
            return {"total_tokens": 0, "total_cost": 0.0, "request_count": 0}
        return {
            "total_tokens": row.total_tokens or 0,
            "total_cost": float(row.total_cost or 0),
            "request_count": row.request_count or 0,
        }

    async def check_quota(self, user_id: str, tenant_id: Optional[int] = None) -> Dict[str, Any]:
        """Check if user/tenant has remaining quota."""
        if not tenant_id:
            return {"allowed": True, "remaining": None, "reason": "no_tenant_quota"}
        tenant = await self.db.execute(select(Tenants).where(Tenants.id == tenant_id))
        tenant_obj = tenant.scalar_one_or_none()
        if not tenant_obj:
            return {"allowed": True, "remaining": None, "reason": "tenant_not_found"}
        max_tokens = tenant_obj.max_tokens_per_month or 1_000_000
        usage_query = select(func.sum(Usage_records.total_tokens)).where(
            Usage_records.tenant_id == tenant_id
        )
        usage_result = await self.db.execute(usage_query)
        used = usage_result.scalar() or 0
        remaining = max(0, max_tokens - used)
        return {"allowed": remaining > 0, "remaining": remaining, "reason": "quota_ok" if remaining > 0 else "quota_exceeded"}

    async def get_tenant_for_user(self, user_id: str) -> Optional[int]:
        """Find the tenant_id for a user."""
        result = await self.db.execute(
            select(Tenant_members.tenant_id).where(Tenant_members.user_id == user_id).limit(1)
        )
        row = result.scalar_one_or_none()
        return row