"""LLM Gateway router - multi-provider forwarding with streaming support.

Routes requests to configured providers using Map-based dispatch.
Integrates with billing service for usage tracking.
"""
import json
import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from dependencies.auth import get_current_user
from schemas.auth import UserResponse
from services.llm_provider import LLMProviderService
from services.billing_service import BillingService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/gateway", tags=["llm-gateway"])


# ---------- Schemas ----------

class GatewayMessage(BaseModel):
    role: str
    content: str


class GatewayRequest(BaseModel):
    messages: List[GatewayMessage]
    model: str
    provider: str = "openai"
    stream: bool = True


class GatewayResponse(BaseModel):
    content: str
    model: str
    provider: str
    usage: Optional[dict] = None


# ---------- Routes ----------

@router.post("/completions")
async def gateway_completions(
    data: GatewayRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Forward chat completion to configured provider with usage tracking."""
    user_id = str(current_user.id)
    llm_service = LLMProviderService(db)
    billing = BillingService(db)

    # Check quota
    tenant_id = await billing.get_tenant_for_user(user_id)
    quota = await billing.check_quota(user_id, tenant_id)
    if not quota["allowed"]:
        raise HTTPException(status_code=429, detail="Token quota exceeded")

    # Get provider config
    config = await llm_service.get_provider_config(data.provider)
    if not config:
        raise HTTPException(status_code=404, detail=f"Provider '{data.provider}' not configured or inactive")

    messages = [{"role": m.role, "content": m.content} for m in data.messages]

    if data.stream:
        return await _handle_stream(llm_service, billing, user_id, tenant_id, messages, data, config)
    return await _handle_complete(llm_service, billing, user_id, tenant_id, messages, data, config)


@router.get("/usage")
async def get_usage_stats(
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get current user's usage statistics."""
    billing = BillingService(db)
    return await billing.get_user_usage_summary(str(current_user.id))


@router.get("/quota")
async def check_quota(
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Check current user's remaining quota."""
    billing = BillingService(db)
    user_id = str(current_user.id)
    tenant_id = await billing.get_tenant_for_user(user_id)
    return await billing.check_quota(user_id, tenant_id)


# ---------- Handlers ----------

async def _handle_stream(llm_service, billing, user_id, tenant_id, messages, data, config):
    """Handle streaming response."""
    async def generate():
        full_content = ""
        async for chunk in llm_service.stream_completion(messages, data.model, config["api_type"], config):
            full_content += chunk
            yield f"data: {json.dumps({'content': chunk, 'done': False})}\n\n"
        yield f"data: {json.dumps({'content': '', 'done': True})}\n\n"
        # Estimate tokens for streaming (rough: 1 token ≈ 4 chars)
        prompt_tokens = sum(len(m["content"]) for m in messages) // 4
        completion_tokens = len(full_content) // 4
        await billing.record_usage(user_id, data.model, data.provider, prompt_tokens, completion_tokens, tenant_id=tenant_id)

    return StreamingResponse(generate(), media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"})


async def _handle_complete(llm_service, billing, user_id, tenant_id, messages, data, config):
    """Handle non-streaming response."""
    result = await llm_service.complete(messages, data.model, config["api_type"], config)
    usage = result.get("usage", {})
    await billing.record_usage(
        user_id, data.model, data.provider,
        usage.get("prompt_tokens", 0), usage.get("completion_tokens", 0),
        tenant_id=tenant_id,
    )
    return GatewayResponse(content=result["content"], model=data.model, provider=data.provider, usage=usage)