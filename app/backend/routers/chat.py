import logging
import json
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from dependencies.auth import get_current_user
from schemas.auth import UserResponse
from services.chat_service import ChatService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/chat", tags=["chat"])


# ---------- Schemas ----------

class ChatMessage(BaseModel):
    role: str
    content: str


class ChatCompletionRequest(BaseModel):
    messages: List[ChatMessage]
    model: str = "deepseek-v4-pro"
    stream: bool = True
    conversation_id: Optional[int] = None
    title: Optional[str] = None


class ChatCompletionResponse(BaseModel):
    content: str
    model: str
    conversation_id: int


# ---------- Models Registry ----------

AVAILABLE_MODELS = [
    {"id": "deepseek-v4-pro", "name": "DeepSeek V4 Pro", "provider": "DeepSeek", "description": "高性价比通用模型"},
    {"id": "gpt-5.4", "name": "GPT-5.4", "provider": "OpenAI", "description": "多模态通用模型"},
    {"id": "claude-opus-4.6", "name": "Claude Opus 4.6", "provider": "Anthropic", "description": "代码专家/高质量"},
    {"id": "gemini-2.5-pro", "name": "Gemini 2.5 Pro", "provider": "Google", "description": "多模态/生产级"},
    {"id": "gemini-3.1-pro-preview", "name": "Gemini 3.1 Pro", "provider": "Google", "description": "最佳多模态/长上下文"},
]


# ---------- Helpers ----------

def extract_title(data: ChatCompletionRequest) -> str:
    """Extract conversation title from request."""
    return data.title or (data.messages[-1].content[:50] if data.messages else "New Chat")


def to_message_dicts(messages: List[ChatMessage]) -> List[dict]:
    """Convert pydantic messages to plain dicts."""
    return [{"role": m.role, "content": m.content} for m in messages]


async def ensure_conversation(
    chat_service: ChatService, user_id: str, data: ChatCompletionRequest
) -> int:
    """Get existing conversation_id or create a new one."""
    if data.conversation_id:
        return data.conversation_id
    conv = await chat_service.create_conversation(user_id, extract_title(data), data.model)
    return conv["id"]


async def save_user_message(
    chat_service: ChatService, user_id: str, conversation_id: int, data: ChatCompletionRequest
):
    """Save the last user message if applicable."""
    if not data.messages:
        return
    last_msg = data.messages[-1]
    if last_msg.role == "user":
        await chat_service.save_message(user_id, conversation_id, "user", last_msg.content, data.model)


async def handle_streaming(
    chat_service: ChatService, db: AsyncSession,
    user_id: str, conversation_id: int, messages: List[dict], model: str
):
    """Return a streaming SSE response."""
    async def generate():
        full_content = ""
        yield f"data: {json.dumps({'conversation_id': conversation_id, 'type': 'meta'})}\n\n"
        async for chunk in chat_service.stream_chat(messages, model):
            full_content = _accumulate_chunk(full_content, chunk)
            yield chunk
        await chat_service.save_message(user_id, conversation_id, "assistant", full_content, model)
        await db.commit()

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"},
    )


async def handle_non_streaming(
    chat_service: ChatService, db: AsyncSession,
    user_id: str, conversation_id: int, messages: List[dict], model: str
):
    """Return a non-streaming JSON response."""
    content = await chat_service.chat_completion(messages, model, stream=False)
    await chat_service.save_message(user_id, conversation_id, "assistant", content, model)
    await db.commit()
    return ChatCompletionResponse(content=content, model=model, conversation_id=conversation_id)


def _accumulate_chunk(full_content: str, chunk: str) -> str:
    """Parse SSE chunk and accumulate content."""
    raw = chunk.replace("data: ", "").strip()
    if not raw:
        return full_content
    parsed = json.loads(raw)
    return full_content + parsed.get("content", "")


# ---------- Route Handlers Map ----------

STREAM_HANDLERS = {
    True: handle_streaming,
    False: handle_non_streaming,
}


# ---------- Routes ----------

@router.post("/completions")
async def chat_completions(
    data: ChatCompletionRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Chat completion endpoint - supports streaming via SSE."""
    chat_service = ChatService(db)
    user_id = str(current_user.id)

    conversation_id = await ensure_conversation(chat_service, user_id, data)
    await save_user_message(chat_service, user_id, conversation_id, data)

    handler = STREAM_HANDLERS[data.stream]
    return await handler(chat_service, db, user_id, conversation_id, to_message_dicts(data.messages), data.model)


@router.get("/models")
async def list_available_models(
    current_user: UserResponse = Depends(get_current_user),
):
    """List available AI models."""
    return {"models": AVAILABLE_MODELS}