import { useState, useEffect, useRef } from 'react';
import { client } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Send, Plus, Bot, User, Loader2, Trash2, Image as ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';

// ---------- Types ----------

interface Message {
  id?: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  model?: string;
  type?: 'text' | 'image';
  imageUrl?: string;
}

interface Conversation {
  id: number;
  title: string;
  model: string;
  created_at: string;
}

// ---------- Constants ----------

const TEXT_MODELS = [
  { id: 'claude-opus-4.6', name: 'Claude Opus 4.6', provider: 'Anthropic', type: 'gentxt' },
  { id: 'gpt-5.4', name: 'GPT-5.4', provider: 'OpenAI', type: 'gentxt' },
  { id: 'deepseek-v4-pro', name: 'DeepSeek V4 Pro', provider: 'DeepSeek', type: 'gentxt' },
  { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro', provider: 'Google', type: 'gentxt' },
];

const IMAGE_MODELS = [
  { id: 'gpt-image-2', name: 'GPT Image 2', provider: 'OpenAI', type: 'genimg' },
  { id: 'gemini-3-pro-image-preview', name: 'Gemini 3 Pro Image', provider: 'Google', type: 'genimg' },
];

const ALL_MODELS = [...TEXT_MODELS, ...IMAGE_MODELS];

const MODEL_TYPE_MAP: Record<string, string> = Object.fromEntries(ALL_MODELS.map((m) => [m.id, m.type]));

// ---------- Sub-components ----------

function ConversationItem({ conv, isActive, onSelect, onDelete, index = 0 }: {
  conv: Conversation; isActive: boolean;
  onSelect: () => void; onDelete: (e: React.MouseEvent) => void; index?: number;
}) {
  return (
    <div
      onClick={onSelect}
      className={cn(
        'group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-sm transition-all animate-slide-in-top',
        isActive ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
          : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
      )}
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <ChatIcon className="w-4 h-4 flex-shrink-0" />
      <span className="truncate flex-1">{conv.title}</span>
      <button onClick={onDelete} className="opacity-0 group-hover:opacity-100 p-1 hover:text-destructive transition-all">
        <Trash2 className="w-3 h-3" />
      </button>
    </div>
  );
}

function BlinkingCursor() {
  return <span className="inline-block w-[2px] h-[1em] bg-current ml-[1px] align-middle animate-cursor-blink" />;
}

function MessageBubble({ msg, isStreaming }: { msg: Message; isStreaming: boolean }) {
  const isUser = msg.role === 'user';
  return (
    <div className={cn('flex gap-3', isUser ? 'justify-end' : 'justify-start')}>
      {!isUser && <AvatarIcon gradient="from-blue-500 to-purple-600" icon={<Bot className="w-4 h-4 text-white" />} />}
      <div className={cn('max-w-[75%] rounded-xl px-4 py-3', isUser ? 'bg-blue-600 text-white' : 'bg-card border border-border')}>
        {msg.type === 'image' && msg.imageUrl ? (
          <div className="space-y-2">
            <img src={msg.imageUrl} alt="Generated" className="rounded-lg max-w-full max-h-96 object-contain" />
            {msg.content && <p className="text-sm text-muted-foreground">{msg.content}</p>}
          </div>
        ) : isUser ? (
          <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
        ) : (
          <div className="markdown-content text-sm">
            {msg.content ? (
              <span>
                <ReactMarkdown>{msg.content}</ReactMarkdown>
                {isStreaming && <BlinkingCursor />}
              </span>
            ) : (
              isStreaming ? (
                <span className="text-muted-foreground">
                  思考中<BlinkingCursor />
                </span>
              ) : null
            )}
          </div>
        )}
      </div>
      {isUser && <AvatarIcon gradient="" icon={<User className="w-4 h-4" />} className="bg-secondary" />}
    </div>
  );
}

function AvatarIcon({ gradient, icon, className }: { gradient: string; icon: React.ReactNode; className?: string }) {
  return (
    <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0', gradient && `bg-gradient-to-br ${gradient}`, className)}>
      {icon}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center mx-auto">
          <Bot className="w-8 h-8 text-blue-400" />
        </div>
        <h3 className="text-lg font-medium">开始新对话</h3>
        <p className="text-sm text-muted-foreground max-w-md">选择模型后输入消息，即可开始与AI对话</p>
      </div>
    </div>
  );
}

function ChatIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function TypingIndicator() {
  return (
    <div className="flex gap-3 justify-start">
      <AvatarIcon gradient="from-blue-500 to-purple-600" icon={<Bot className="w-4 h-4 text-white" />} />
      <div className="bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:0ms]" />
        <span className="w-2 h-2 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:150ms]" />
        <span className="w-2 h-2 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:300ms]" />
      </div>
    </div>
  );
}

function ConversationListSkeleton() {
  return (
    <div className="p-2 space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-2 px-3 py-2">
          <Skeleton className="w-4 h-4 rounded" />
          <Skeleton className="h-4 flex-1" />
        </div>
      ))}
    </div>
  );
}

// ---------- Main Component ----------

export default function ChatPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [model, setModel] = useState('deepseek-v4-pro');
  const [loading, setLoading] = useState(false);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [waitingResponse, setWaitingResponse] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { loadConversations(); }, []);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, waitingResponse]);

  const loadConversations = async () => {
    try {
      const res = await client.entities.conversations.query({ sort: '-created_at', limit: 50 });
      setConversations(res.data?.items || []);
    } catch { /* ignore if not logged in */ }
    setLoadingConvs(false);
  };

  const loadMessages = async (convId: number) => {
    const res = await client.entities.messages.query({ query: { conversation_id: convId }, sort: 'created_at', limit: 200 });
    setMessages((res.data?.items || []).map((m: any) => ({
      id: m.id, role: m.role, content: m.content, model: m.model,
      type: m.type || 'text', imageUrl: m.image_url || undefined,
    })));
  };

  const selectConversation = (conv: Conversation) => {
    setActiveConvId(conv.id);
    setModel(conv.model || 'deepseek-v4-pro');
    loadMessages(conv.id);
  };

  const startNewChat = () => {
    setActiveConvId(null);
    setMessages([]);
    setInput('');
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMsg: Message = { role: 'user', content: input.trim() };
    // Optimistic: show user message immediately
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setWaitingResponse(true);

    const modelType = MODEL_TYPE_MAP[model] || 'gentxt';

    if (modelType === 'genimg') {
      setWaitingResponse(false);
      await handleImageGeneration(userMsg);
    } else {
      await handleTextGeneration(userMsg);
    }
    setWaitingResponse(false);
    setLoading(false);
  };

  const handleTextGeneration = async (userMsg: Message) => {
    // Hide typing indicator, show streaming assistant message
    setWaitingResponse(false);
    const assistantMsg: Message = { role: 'assistant', content: '', model, type: 'text' };
    setMessages((prev) => [...prev, assistantMsg]);

    const allMsgs = [...messages, userMsg].map((m) => ({ role: m.role, content: m.content }));

    try {
      await client.ai.gentxt({
        messages: allMsgs,
        model,
        stream: true,
        onChunk: (chunk: any) => {
          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last.role === 'assistant') {
              updated[updated.length - 1] = { ...last, content: last.content + (chunk.content || '') };
            }
            return updated;
          });
        },
        onComplete: (finalResult: any) => {
          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last.role === 'assistant') {
              updated[updated.length - 1] = { ...last, content: finalResult.content || last.content };
            }
            return updated;
          });
          saveConversation(userMsg.content, finalResult.content || '');
        },
        onError: (error: any) => {
          toast.error(error?.message || '请求失败，请重试');
          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last.role === 'assistant') {
              updated[updated.length - 1] = { ...last, content: '⚠️ 请求失败: ' + (error?.message || '未知错误') };
            }
            return updated;
          });
        },
      });
    } catch (e: any) {
      toast.error(e?.message || '请求失败');
      setMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last.role === 'assistant') {
          updated[updated.length - 1] = { ...last, content: '⚠️ 请求失败: ' + (e?.message || '未知错误') };
        }
        return updated;
      });
    }
  };

  const handleImageGeneration = async (userMsg: Message) => {
    setMessages((prev) => [...prev, { role: 'assistant', content: '正在生成图片...', model, type: 'text' }]);

    try {
      const response = await client.ai.genimg(
        { prompt: userMsg.content, model, size: '1024x1024', quality: 'standard', n: 1 },
        { timeout: 600_000 }
      );
      const imageUrl = response.data?.images?.[0] || '';
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: 'assistant', content: '图片已生成', model, type: 'image', imageUrl,
        };
        return updated;
      });
      saveConversation(userMsg.content, '[图片生成]');
      toast.success('图片生成成功');
    } catch (e: any) {
      toast.error(e?.message || '图片生成失败');
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: 'assistant', content: '⚠️ 图片生成失败: ' + (e?.message || '未知错误'), model, type: 'text',
        };
        return updated;
      });
    }
  };

  const saveConversation = async (userContent: string, assistantContent: string) => {
    try {
      let convId = activeConvId;
      if (!convId) {
        const res = await client.entities.conversations.create({
          data: { title: userContent.slice(0, 50), model },
        });
        convId = res.data?.id;
        setActiveConvId(convId);
        loadConversations();
      }
      if (convId) {
        await client.entities.messages.create({ data: { conversation_id: convId, role: 'user', content: userContent, model } });
        await client.entities.messages.create({ data: { conversation_id: convId, role: 'assistant', content: assistantContent, model } });
      }
    } catch { /* ignore save errors */ }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const deleteConversation = (convId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    // Optimistic UI
    const previousConvs = conversations;
    setConversations((prev) => prev.filter((c) => c.id !== convId));
    if (activeConvId === convId) startNewChat();
    toast.success('对话已删除');

    client.entities.conversations.delete({ id: String(convId) }).catch(() => {
      setConversations(previousConvs);
      toast.error('删除失败，已恢复');
    });
  };

  const isImageModel = MODEL_TYPE_MAP[model] === 'genimg';

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      {/* Sidebar */}
      <div className="w-64 border-r border-border flex flex-col bg-card/50">
        <div className="p-3 border-b border-border">
          <Button onClick={startNewChat} className="w-full" variant="outline" size="sm">
            <Plus className="w-4 h-4 mr-2" /> 新建对话
          </Button>
        </div>
        <ScrollArea className="flex-1">
          {loadingConvs ? <ConversationListSkeleton /> : (
            <div className="p-2 space-y-1">
              {conversations.map((conv, i) => (
                <ConversationItem key={conv.id} conv={conv} isActive={activeConvId === conv.id} index={i}
                  onSelect={() => selectConversation(conv)} onDelete={(e) => deleteConversation(conv.id, e)} />
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col">
        <ModelSelector model={model} onChange={setModel} isImageModel={isImageModel} />
        <ScrollArea className="flex-1 p-4">
          {messages.length === 0 && !waitingResponse ? <EmptyState /> : (
            <div className="space-y-4 max-w-4xl mx-auto">
              {messages.map((msg, i) => (
                <MessageBubble key={i} msg={msg} isStreaming={loading && i === messages.length - 1 && msg.role === 'assistant'} />
              ))}
              {waitingResponse && <TypingIndicator />}
              <div ref={messagesEndRef} />
            </div>
          )}
        </ScrollArea>
        <ChatInput input={input} loading={loading} isImageModel={isImageModel}
          onChange={setInput} onKeyDown={handleKeyDown} onSend={sendMessage} />
      </div>
    </div>
  );
}

// ---------- Extracted UI Sections ----------

function ModelSelector({ model, onChange, isImageModel }: { model: string; onChange: (v: string) => void; isImageModel: boolean }) {
  return (
    <div className="p-3 border-b border-border flex items-center gap-3">
      <Select value={model} onValueChange={onChange}>
        <SelectTrigger className="w-72"><SelectValue /></SelectTrigger>
        <SelectContent>
          <div className="px-2 py-1 text-xs text-muted-foreground font-medium">文本生成模型</div>
          {TEXT_MODELS.map((m) => (
            <SelectItem key={m.id} value={m.id}>
              <span className="flex items-center gap-2">
                <span className="font-medium">{m.name}</span>
                <span className="text-xs text-muted-foreground">({m.provider})</span>
              </span>
            </SelectItem>
          ))}
          <div className="px-2 py-1 text-xs text-muted-foreground font-medium mt-1">图片生成模型</div>
          {IMAGE_MODELS.map((m) => (
            <SelectItem key={m.id} value={m.id}>
              <span className="flex items-center gap-2">
                <ImageIcon className="w-3 h-3 text-amber-400" />
                <span className="font-medium">{m.name}</span>
                <span className="text-xs text-muted-foreground">({m.provider})</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {isImageModel && (
        <span className="text-xs text-amber-400 flex items-center gap-1">
          <ImageIcon className="w-3 h-3" /> 图片生成模式
        </span>
      )}
    </div>
  );
}

function ChatInput({ input, loading, isImageModel, onChange, onKeyDown, onSend }: {
  input: string; loading: boolean; isImageModel: boolean;
  onChange: (v: string) => void; onKeyDown: (e: React.KeyboardEvent) => void; onSend: () => void;
}) {
  return (
    <div className="p-4 border-t border-border">
      <div className="max-w-4xl mx-auto flex gap-2">
        <Textarea value={input} onChange={(e) => onChange(e.target.value)} onKeyDown={onKeyDown}
          placeholder={isImageModel ? '描述你想生成的图片...' : '输入消息... (Shift+Enter换行)'} className="min-h-[44px] max-h-32 resize-none" rows={1} />
        <Button onClick={onSend} disabled={!input.trim() || loading}
          className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 px-4">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </div>
    </div>
  );
}