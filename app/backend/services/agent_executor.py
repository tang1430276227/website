"""Agent execution service.

Handles agent code storage, execution scheduling, and result tracking.
Uses the AI service for LLM-powered agent execution.
"""
import json
import logging
import time
from typing import Any, Dict, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from services.agents import AgentsService
from services.agent_executions import Agent_executionsService
from services.aihub import AIHubService
from schemas.aihub import GenTxtRequest, ChatMessage

logger = logging.getLogger(__name__)


# ---------- Execution Strategies Map ----------

EXECUTION_STRATEGIES = {
    "prompt_agent": "_execute_prompt_agent",
    "code_agent": "_execute_code_agent",
}


# ---------- Main Service ----------

class AgentExecutorService:
    """Manages agent execution lifecycle."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self._agents_service = AgentsService(db)
        self._executions_service = Agent_executionsService(db)
        self._ai_service = AIHubService()

    async def execute_agent(self, agent_id: int, input_text: str, user_id: str) -> Dict[str, Any]:
        """Execute an agent and return the result."""
        agent = await self._agents_service.get_by_id(agent_id, user_id=user_id)
        if not agent:
            raise ValueError(f"Agent {agent_id} not found or access denied")

        execution = await self._executions_service.create({
            "agent_id": agent_id,
            "input_text": input_text,
            "output_text": "",
            "status": "running",
        }, user_id=user_id)

        start_time = time.time()
        strategy = self._determine_strategy(agent)
        handler = getattr(self, EXECUTION_STRATEGIES[strategy])
        result = await handler(agent, input_text)
        elapsed_ms = int((time.time() - start_time) * 1000)

        await self._executions_service.update(execution.id, {
            "output_text": result["output"],
            "status": result["status"],
            "error_message": result.get("error", ""),
            "execution_time_ms": elapsed_ms,
        }, user_id=user_id)

        return {
            "execution_id": execution.id,
            "output": result["output"],
            "status": result["status"],
            "execution_time_ms": elapsed_ms,
        }

    def _determine_strategy(self, agent) -> str:
        """Determine execution strategy based on agent configuration."""
        has_code = bool(agent.code and agent.code.strip() and "class" in agent.code)
        return "code_agent" if has_code else "prompt_agent"

    async def _execute_prompt_agent(self, agent, input_text: str) -> Dict[str, Any]:
        """Execute agent using system prompt + LLM."""
        messages = self._build_messages(agent.system_prompt, input_text)
        model = agent.model or "deepseek-v4-pro"
        request = GenTxtRequest(messages=messages, model=model)
        response = await self._ai_service.gentxt(request)
        return {"output": response.content, "status": "completed"}

    async def _execute_code_agent(self, agent, input_text: str) -> Dict[str, Any]:
        """Execute agent with code-augmented prompting."""
        code_context = f"Agent code context:\n```python\n{agent.code}\n```\n"
        enhanced_prompt = f"{agent.system_prompt or ''}\n\n{code_context}\nProcess the following input according to the agent logic above."
        messages = self._build_messages(enhanced_prompt, input_text)
        model = agent.model or "deepseek-v4-pro"
        request = GenTxtRequest(messages=messages, model=model)
        response = await self._ai_service.gentxt(request)
        return {"output": response.content, "status": "completed"}

    def _build_messages(self, system_prompt: Optional[str], user_input: str) -> list:
        """Build chat messages for LLM call."""
        messages = []
        if system_prompt:
            messages.append(ChatMessage(role="system", content=system_prompt))
        messages.append(ChatMessage(role="user", content=user_input))
        return messages