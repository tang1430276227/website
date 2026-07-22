"""Multi-provider LLM forwarding service.

Uses a Map-based dispatch pattern to route requests to different providers.
Each provider adapter handles its own API format and streaming.
"""
import json
import logging
from typing import Any, AsyncGenerator, Callable, Dict, List, Optional

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from services.model_providers import Model_providersService

logger = logging.getLogger(__name__)


# ---------- Provider Adapters ----------

async def _openai_stream(client: httpx.AsyncClient, config: Dict[str, Any], messages: List[Dict], model: str) -> AsyncGenerator[str, None]:
    """Stream from OpenAI-compatible API."""
    headers = {"Authorization": f"Bearer {config['api_key']}", "Content-Type": "application/json"}
    payload = {"model": model, "messages": messages, "stream": True}
    async with client.stream("POST", f"{config['base_url']}/chat/completions", json=payload, headers=headers, timeout=120.0) as resp:
        resp.raise_for_status()
        async for line in resp.aiter_lines():
            chunk = _parse_sse_line(line)
            if chunk:
                yield chunk


async def _anthropic_stream(client: httpx.AsyncClient, config: Dict[str, Any], messages: List[Dict], model: str) -> AsyncGenerator[str, None]:
    """Stream from Anthropic API."""
    headers = {"x-api-key": config['api_key'], "anthropic-version": "2023-06-01", "Content-Type": "application/json"}
    system_msg = _extract_system_message(messages)
    user_messages = [m for m in messages if m["role"] != "system"]
    payload = {"model": model, "messages": user_messages, "max_tokens": 4096, "stream": True}
    if system_msg:
        payload["system"] = system_msg
    async with client.stream("POST", f"{config['base_url']}/messages", json=payload, headers=headers, timeout=120.0) as resp:
        resp.raise_for_status()
        async for line in resp.aiter_lines():
            chunk = _parse_anthropic_sse(line)
            if chunk:
                yield chunk


async def _google_stream(client: httpx.AsyncClient, config: Dict[str, Any], messages: List[Dict], model: str) -> AsyncGenerator[str, None]:
    """Stream from Google Gemini API (OpenAI-compatible mode)."""
    headers = {"Authorization": f"Bearer {config['api_key']}", "Content-Type": "application/json"}
    payload = {"model": model, "messages": messages, "stream": True}
    base = config['base_url'].rstrip('/')
    async with client.stream("POST", f"{base}/chat/completions", json=payload, headers=headers, timeout=120.0) as resp:
        resp.raise_for_status()
        async for line in resp.aiter_lines():
            chunk = _parse_sse_line(line)
            if chunk:
                yield chunk


# ---------- Provider Dispatch Map ----------

PROVIDER_STREAM_MAP: Dict[str, Callable] = {
    "openai": _openai_stream,
    "deepseek": _openai_stream,
    "zhipu": _openai_stream,
    "qwen": _openai_stream,
    "custom": _openai_stream,
    "anthropic": _anthropic_stream,
    "google": _google_stream,
}


# ---------- Non-streaming Adapters ----------

async def _openai_complete(client: httpx.AsyncClient, config: Dict[str, Any], messages: List[Dict], model: str) -> Dict[str, Any]:
    """Non-streaming completion from OpenAI-compatible API."""
    headers = {"Authorization": f"Bearer {config['api_key']}", "Content-Type": "application/json"}
    payload = {"model": model, "messages": messages, "stream": False}
    resp = await client.post(f"{config['base_url']}/chat/completions", json=payload, headers=headers, timeout=120.0)
    resp.raise_for_status()
    data = resp.json()
    content = data["choices"][0]["message"]["content"]
    usage = data.get("usage", {})
    return {"content": content, "usage": usage}


async def _anthropic_complete(client: httpx.AsyncClient, config: Dict[str, Any], messages: List[Dict], model: str) -> Dict[str, Any]:
    """Non-streaming completion from Anthropic API."""
    headers = {"x-api-key": config['api_key'], "anthropic-version": "2023-06-01", "Content-Type": "application/json"}
    system_msg = _extract_system_message(messages)
    user_messages = [m for m in messages if m["role"] != "system"]
    payload = {"model": model, "messages": user_messages, "max_tokens": 4096}
    if system_msg:
        payload["system"] = system_msg
    resp = await client.post(f"{config['base_url']}/messages", json=payload, headers=headers, timeout=120.0)
    resp.raise_for_status()
    data = resp.json()
    content = "".join(block["text"] for block in data.get("content", []) if block.get("type") == "text")
    usage = {"prompt_tokens": data.get("usage", {}).get("input_tokens", 0), "completion_tokens": data.get("usage", {}).get("output_tokens", 0)}
    usage["total_tokens"] = usage["prompt_tokens"] + usage["completion_tokens"]
    return {"content": content, "usage": usage}


PROVIDER_COMPLETE_MAP: Dict[str, Callable] = {
    "openai": _openai_complete,
    "deepseek": _openai_complete,
    "zhipu": _openai_complete,
    "qwen": _openai_complete,
    "custom": _openai_complete,
    "anthropic": _anthropic_complete,
    "google": _openai_complete,
}


# ---------- Helpers ----------

def _parse_sse_line(line: str) -> Optional[str]:
    """Parse SSE line from OpenAI-compatible stream."""
    if not line.startswith("data: "):
        return None
    data = line[6:].strip()
    if data == "[DONE]":
        return None
    parsed = json.loads(data)
    delta = parsed.get("choices", [{}])[0].get("delta", {})
    return delta.get("content")


def _parse_anthropic_sse(line: str) -> Optional[str]:
    """Parse SSE line from Anthropic stream."""
    if not line.startswith("data: "):
        return None
    data = line[6:].strip()
    parsed = json.loads(data)
    if parsed.get("type") == "content_block_delta":
        return parsed.get("delta", {}).get("text")
    return None


def _extract_system_message(messages: List[Dict]) -> Optional[str]:
    """Extract system message content from message list."""
    for msg in messages:
        if msg.get("role") == "system":
            return msg["content"]
    return None


# ---------- Main Service ----------

class LLMProviderService:
    """Routes LLM requests to configured providers using Map dispatch."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self._provider_service = Model_providersService(db)

    async def get_provider_config(self, provider_name: str) -> Optional[Dict[str, Any]]:
        """Load provider config from database."""
        provider = await self._provider_service.get_by_field("name", provider_name)
        if not provider or not provider.is_active:
            return None
        return {
            "api_type": provider.api_type,
            "base_url": provider.base_url.rstrip("/"),
            "api_key": provider.api_key_encrypted or "",
            "models": (provider.models or "").split(","),
        }

    async def stream_completion(
        self, messages: List[Dict], model: str, provider_type: str, config: Dict[str, Any]
    ) -> AsyncGenerator[str, None]:
        """Stream completion using provider-specific adapter."""
        adapter = PROVIDER_STREAM_MAP.get(provider_type, _openai_stream)
        async with httpx.AsyncClient() as client:
            async for chunk in adapter(client, config, messages, model):
                yield chunk

    async def complete(
        self, messages: List[Dict], model: str, provider_type: str, config: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Non-streaming completion using provider-specific adapter."""
        adapter = PROVIDER_COMPLETE_MAP.get(provider_type, _openai_complete)
        async with httpx.AsyncClient() as client:
            return await adapter(client, config, messages, model)