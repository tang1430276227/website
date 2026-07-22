"""Agent execution router.

Provides endpoints for running agents and retrieving execution history.
"""
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from dependencies.auth import get_current_user
from schemas.auth import UserResponse
from services.agent_executor import AgentExecutorService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/agents", tags=["agent-executor"])


# ---------- Schemas ----------

class AgentRunRequest(BaseModel):
    agent_id: int
    input_text: str


class AgentRunResponse(BaseModel):
    execution_id: int
    output: str
    status: str
    execution_time_ms: int


# ---------- Routes ----------

@router.post("/run", response_model=AgentRunResponse)
async def run_agent(
    data: AgentRunRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Execute an agent with the given input."""
    executor = AgentExecutorService(db)
    user_id = str(current_user.id)
    result = await executor.execute_agent(data.agent_id, data.input_text, user_id)
    return AgentRunResponse(**result)


@router.get("/executions")
async def list_executions(
    agent_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 20,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List agent execution history."""
    from services.agent_executions import Agent_executionsService
    service = Agent_executionsService(db)
    user_id = str(current_user.id)
    query_dict = {"agent_id": agent_id} if agent_id else None
    return await service.get_list(skip=skip, limit=limit, user_id=user_id, query_dict=query_dict, sort="-created_at")