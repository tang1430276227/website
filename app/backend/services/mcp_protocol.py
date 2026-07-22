"""MCP (Model Context Protocol) communication service.

Handles MCP Server registration, connection management, tool discovery,
and tool invocation via SSE/HTTP transport.
"""
import json
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from services.mcp_tools import Mcp_toolsService
from services.mcp_connections import Mcp_connectionsService

logger = logging.getLogger(__name__)


# ---------- Auth Strategy Map ----------

AUTH_BUILDERS: Dict[str, Any] = {
    "none": lambda config: {},
    "bearer": lambda config: {"Authorization": f"Bearer {config.get('token', '')}"},
    "api_key": lambda config: {"X-API-Key": config.get("api_key", "")},
    "oauth": lambda config: {"Authorization": f"Bearer {config.get('access_token', '')}"},
}


# ---------- Helpers ----------

def build_auth_headers(auth_type: str, auth_config_str: str) -> Dict[str, str]:
    """Build auth headers using dispatch map."""
    config = _parse_auth_config(auth_config_str)
    builder = AUTH_BUILDERS.get(auth_type, AUTH_BUILDERS["none"])
    return builder(config)


def _parse_auth_config(config_str: str) -> Dict[str, Any]:
    """Parse auth config JSON string safely."""
    if not config_str or not config_str.strip():
        return {}
    return json.loads(config_str)


# ---------- Main Service ----------

class MCPProtocolService:
    """Manages MCP Server connections and tool invocations."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self._tools_service = Mcp_toolsService(db)
        self._connections_service = Mcp_connectionsService(db)

    async def discover_tools(self, mcp_tool_id: int, user_id: str) -> Dict[str, Any]:
        """Connect to MCP server and discover available tools."""
        tool = await self._tools_service.get_by_id(mcp_tool_id, user_id=user_id)
        if not tool:
            raise ValueError(f"MCP tool {mcp_tool_id} not found")

        headers = build_auth_headers(tool.auth_type or "none", tool.auth_config or "")
        headers["Content-Type"] = "application/json"

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{tool.server_url.rstrip('/')}/tools/list",
                headers=headers,
                json={"jsonrpc": "2.0", "method": "tools/list", "id": 1},
            )
            response.raise_for_status()
            data = response.json()

        tools_list = data.get("result", {}).get("tools", [])
        await self._update_connection_status(mcp_tool_id, user_id, "connected")
        await self._tools_service.update(mcp_tool_id, {"tools_schema": json.dumps(tools_list)}, user_id=user_id)

        return {"tools": tools_list, "count": len(tools_list)}

    async def invoke_tool(
        self, mcp_tool_id: int, tool_name: str, arguments: Dict[str, Any], user_id: str
    ) -> Dict[str, Any]:
        """Invoke a specific tool on an MCP server."""
        tool = await self._tools_service.get_by_id(mcp_tool_id, user_id=user_id)
        if not tool:
            raise ValueError(f"MCP tool {mcp_tool_id} not found")

        headers = build_auth_headers(tool.auth_type or "none", tool.auth_config or "")
        headers["Content-Type"] = "application/json"

        payload = {
            "jsonrpc": "2.0",
            "method": "tools/call",
            "id": 1,
            "params": {"name": tool_name, "arguments": arguments},
        }

        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{tool.server_url.rstrip('/')}/tools/call",
                headers=headers,
                json=payload,
            )
            response.raise_for_status()
            data = response.json()

        result = data.get("result", {})
        return {"tool_name": tool_name, "result": result}

    async def ping_server(self, mcp_tool_id: int, user_id: str) -> Dict[str, Any]:
        """Ping MCP server to check connectivity."""
        tool = await self._tools_service.get_by_id(mcp_tool_id, user_id=user_id)
        if not tool:
            raise ValueError(f"MCP tool {mcp_tool_id} not found")

        headers = build_auth_headers(tool.auth_type or "none", tool.auth_config or "")

        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(tool.server_url.rstrip('/'), headers=headers)
            is_alive = response.status_code < 500

        status = "connected" if is_alive else "error"
        await self._update_connection_status(mcp_tool_id, user_id, status)
        return {"status": status, "server_url": tool.server_url}

    async def _update_connection_status(self, mcp_tool_id: int, user_id: str, status: str):
        """Update or create connection record."""
        existing = await self._connections_service.get_list(
            user_id=user_id, query_dict={"mcp_tool_id": mcp_tool_id}, limit=1
        )
        if existing["items"]:
            await self._connections_service.update(
                existing["items"][0].id,
                {"status": status, "last_ping_at": datetime.utcnow().isoformat()},
                user_id=user_id,
            )
        else:
            await self._connections_service.create({
                "mcp_tool_id": mcp_tool_id,
                "status": status,
                "last_ping_at": datetime.utcnow().isoformat(),
            }, user_id=user_id)