import logging
import json
from typing import Dict, Any, List, AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession

from services.aihub import AIHubService
from schemas.aihub import GenTxtRequest, ChatMessage
from services.conversations import ConversationsService
from services.messages import MessagesService

logger = logging.getLogger(__name__)


class ChatService:
    """Service for proxying chat requests to different LLM providers."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.ai_service = AIHubService()

    async def create_conversation(self, user_id: str, title: str, model: str) -> Dict[str, Any]:
        """Create a new conversation record."""
        conv_service = ConversationsService(self.db)
        conv = await conv_service.create({"title": title, "model": model}, user_id=user_id)
        return {"id": conv.id, "title": conv.title, "model": conv.model}

    async def save_message(
        self, user_id: str, conversation_id: int, role: str, content: str, model: str = ""
    ):
        """Persist a single message to the database."""
        msg_service = MessagesService(self.db)
        await msg_service.create(
            {"conversation_id": conversation_id, "role": role, "content": content, "model": model, "tokens_used": 0},
            user_id=user_id,
        )

    async def chat_completion(self, messages: List[Dict[str, str]], model: str, stream: bool = True):
        """Forward chat request to AI service (non-streaming returns content string)."""
        request = self._build_request(messages, model)
        if stream:
            return self.ai_service.gentxt_stream(request)
        response = await self.ai_service.gentxt(request)
        return response.content

    async def stream_chat(self, messages: List[Dict[str, str]], model: str) -> AsyncGenerator[str, None]:
        """Stream chat completion as SSE events."""
        request = self._build_request(messages, model)
        full_content = ""
        async for chunk in self.ai_service.gentxt_stream(request):
            full_content += chunk
            yield f"data: {json.dumps({'content': chunk, 'done': False})}\n\n"
        yield f"data: {json.dumps({'content': '', 'done': True, 'full_content': full_content})}\n\n"

    def _build_request(self, messages: List[Dict[str, str]], model: str) -> GenTxtRequest:
        """Build GenTxtRequest from raw message dicts."""
        chat_messages = [ChatMessage(role=m["role"], content=m["content"]) for m in messages]
        return GenTxtRequest(messages=chat_messages, model=model)