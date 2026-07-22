"""MCP Protocol router.

Provides endpoints for MCP server discovery, tool invocation, and health checks.
"""
import logging
from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from dependencies.auth import get_current_user
from schemas.auth import UserResponse
from services.mcp_protocol import MCPProtocolService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/mcp", tags=["mcp-protocol"])


# ---------- Schemas ----------

class ToolInvokeRequest(BaseModel):
    mcp_tool_id: int
    tool_name: str
    arguments: Dict[str, Any] = {}


# ---------- Routes ----------

@router.post("/discover/{mcp_tool_id}")
async def discover_tools(
    mcp_tool_id: int,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Connect to MCP server and discover available tools."""
    service = MCPProtocolService(db)
    return await service.discover_tools(mcp_tool_id, str(current_user.id))


@router.post("/invoke")
async def invoke_tool(
    data: ToolInvokeRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Invoke a tool on an MCP server."""
    service = MCPProtocolService(db)
    return await service.invoke_tool(data.mcp_tool_id, data.tool_name, data.arguments, str(current_user.id))


@router.post("/ping/{mcp_tool_id}")
async def ping_server(
    mcp_tool_id: int,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Ping MCP server to check connectivity."""
    service = MCPProtocolService(db)
    return await service.ping_server(mcp_tool_id, str(current_user.id))