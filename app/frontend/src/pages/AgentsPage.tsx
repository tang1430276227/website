import { useState, useEffect } from 'react';
import { client } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Bot, Code, Play, Trash2, Edit, Save, Loader2, Clock, CheckCircle, XCircle, ArrowLeft, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import MonacoEditor from '@monaco-editor/react';

// ---------- Types & Constants ----------

interface Agent {
  id: number;
  name: string;
  description: string;
  system_prompt: string;
  code: string;
  model: string;
  status: string;
  created_at: string;
}

interface Execution {
  id: number;
  input_text: string;
  output_text: string;
  status: string;
  execution_time_ms: number;
  created_at: string;
}

const MODEL_OPTIONS = [
  { value: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro' },
  { value: 'gpt-5.4', label: 'GPT-5.4' },
  { value: 'claude-opus-4.6', label: 'Claude Opus 4.6' },
  { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
];

const STATUS_ICONS: Record<string, any> = {
  completed: CheckCircle,
  running: Loader2,
  failed: XCircle,
  pending: Clock,
};

const AGENT_TYPE_MAP: Record<string, { label: string; gradient: string; description: string; highlights: string[] }> = {
  'deepseek-v4-pro': { label: '高效推理', gradient: 'from-cyan-500 to-blue-600', description: '基于DeepSeek V4 Pro的高效推理Agent，适合批量处理和成本敏感场景', highlights: ['成本优化', '快速响应', '批量处理'] },
  'gpt-5.4': { label: '通用智能', gradient: 'from-emerald-500 to-teal-600', description: '基于GPT-5.4的通用智能Agent，具备强大的多模态理解和创作能力', highlights: ['多模态', '创意写作', '逻辑推理'] },
  'claude-opus-4.6': { label: '代码专家', gradient: 'from-purple-500 to-pink-600', description: '基于Claude Opus 4.6的代码专家Agent，擅长代码生成、审查和重构', highlights: ['代码生成', '代码审查', '架构设计'] },
  'gemini-2.5-pro': { label: '长文本', gradient: 'from-orange-500 to-red-600', description: '基于Gemini 2.5 Pro的长上下文Agent，支持超长文档分析和总结', highlights: ['长上下文', '文档分析', '信息提取'] },
};

const DEFAULT_CODE = `# AI Agent 代码
class MyAgent:
    def __init__(self, config):
        self.config = config
        self.model = config.get("model", "deepseek-v4-pro")

    async def run(self, input_text: str) -> str:
        response = await self.call_model(input_text)
        return response

    async def call_model(self, prompt: str) -> str:
        pass

agent = MyAgent({"model": "deepseek-v4-pro"})
`;

const EMPTY_FORM = { name: '', description: '', system_prompt: '', code: DEFAULT_CODE, model: 'deepseek-v4-pro' };

// ---------- Sub-components ----------

function AgentCard({ agent, onSelect, index = 0 }: { agent: Agent; onSelect: () => void; index?: number }) {
  const typeInfo = AGENT_TYPE_MAP[agent.model] || AGENT_TYPE_MAP['deepseek-v4-pro'];
  return (
    <Card className="group cursor-pointer hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/10 transition-all duration-300 animate-slide-in"
      style={{ animationDelay: `${index * 100}ms` }} onClick={onSelect}>
      <CardContent className="p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${typeInfo.gradient} flex items-center justify-center`}>
            <Bot className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg group-hover:text-blue-400 transition-colors truncate">{agent.name}</h3>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">{typeInfo.label}</Badge>
              <Badge variant={agent.status === 'active' ? 'default' : 'secondary'} className="text-xs">{agent.status || 'draft'}</Badge>
            </div>
          </div>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">{agent.description || typeInfo.description}</p>
        <div className="flex flex-wrap gap-2">
          {typeInfo.highlights.map((h) => (
            <Badge key={h} variant="secondary" className="text-xs font-normal">
              <Sparkles className="w-3 h-3 mr-1" />{h}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function CardSkeleton() {
  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Skeleton className="w-12 h-12 rounded-xl" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-20" />
          </div>
        </div>
        <Skeleton className="h-4 w-full" />
        <div className="flex gap-2">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-16" />
        </div>
      </CardContent>
    </Card>
  );
}

function ModelSelect({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled: boolean }) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger><SelectValue /></SelectTrigger>
      <SelectContent>
        {MODEL_OPTIONS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

function ExecutionItem({ exec }: { exec: Execution }) {
  const Icon = STATUS_ICONS[exec.status] || Clock;
  const statusColor = exec.status === 'completed' ? 'text-emerald-400' : exec.status === 'failed' ? 'text-destructive' : 'text-muted-foreground';
  return (
    <div className="border border-border rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className={`w-4 h-4 ${statusColor} ${exec.status === 'running' ? 'animate-spin' : ''}`} />
          <Badge variant="outline" className="text-[10px]">{exec.status}</Badge>
        </div>
        <span className="text-xs text-muted-foreground">{exec.execution_time_ms}ms</span>
      </div>
      <div className="text-xs"><span className="text-muted-foreground">输入:</span> <span className="text-foreground">{exec.input_text.slice(0, 100)}</span></div>
      {exec.output_text && <div className="text-xs bg-secondary/50 rounded p-2 max-h-32 overflow-auto whitespace-pre-wrap">{exec.output_text}</div>}
    </div>
  );
}

// ---------- Detail View ----------

function AgentDetailView({ agent, onBack, onRefresh }: { agent: Agent; onBack: () => void; onRefresh: () => void }) {
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({ name: agent.name, description: agent.description || '', system_prompt: agent.system_prompt || '', code: agent.code || DEFAULT_CODE, model: agent.model || 'deepseek-v4-pro' });
  const [testInput, setTestInput] = useState('');
  const [testOutput, setTestOutput] = useState('');
  const [testRunning, setTestRunning] = useState(false);
  const [executions, setExecutions] = useState<Execution[]>([]);

  useEffect(() => { loadExecutions(); }, []);

  const loadExecutions = async () => {
    const res = await client.entities.agent_executions.query({ query: { agent_id: agent.id }, sort: '-created_at', limit: 10 });
    setExecutions(res.data?.items || []);
  };

  const updateField = (key: string, value: string) => setForm({ ...form, [key]: value });

  const saveAgent = async () => {
    await client.entities.agents.update({ id: String(agent.id), data: form });
    toast.success('Agent更新成功');
    setEditMode(false);
    onRefresh();
  };

  const deleteAgent = () => {
    client.entities.agents.delete({ id: String(agent.id) }).then(() => {
      toast.success('Agent已删除');
      onBack();
      onRefresh();
    }).catch(() => toast.error('删除失败'));
  };

  const runAgent = async () => {
    if (!testInput.trim()) { toast.error('请输入测试内容'); return; }
    setTestRunning(true);
    setTestOutput('');
    const response = await client.apiCall.invoke({
      url: '/api/v1/agents/run',
      method: 'POST',
      data: { agent_id: agent.id, input_text: testInput.trim() },
      options: { timeout: 120000 },
    });
    setTestOutput(response.data.output || '执行完成，无输出');
    toast.success(`执行完成 (${response.data.execution_time_ms}ms)`);
    setTestRunning(false);
    loadExecutions();
  };

  const typeInfo = AGENT_TYPE_MAP[agent.model] || AGENT_TYPE_MAP['deepseek-v4-pro'];

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="w-5 h-5" /></Button>
          <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${typeInfo.gradient} flex items-center justify-center`}>
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="font-semibold">{agent.name}</h2>
            <p className="text-xs text-muted-foreground">{agent.description || '无描述'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {editMode ? (
            <>
              <Button size="sm" variant="outline" onClick={() => setEditMode(false)}>取消</Button>
              <Button size="sm" onClick={saveAgent}><Save className="w-4 h-4 mr-1" /> 保存</Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="outline" onClick={() => setEditMode(true)}><Edit className="w-4 h-4 mr-1" /> 编辑</Button>
              <Button size="sm" variant="destructive" onClick={deleteAgent}><Trash2 className="w-4 h-4" /></Button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="code" className="flex-1 flex flex-col">
        <TabsList className="mx-4 mt-2 w-fit">
          <TabsTrigger value="code"><Code className="w-4 h-4 mr-1" /> 代码编辑</TabsTrigger>
          <TabsTrigger value="config">配置</TabsTrigger>
          <TabsTrigger value="test"><Play className="w-4 h-4 mr-1" /> 测试运行</TabsTrigger>
        </TabsList>
        <TabsContent value="code" className="flex-1 m-0 p-4">
          <div className="h-full rounded-lg overflow-hidden border border-border">
            <MonacoEditor height="100%" language="python" theme="vs-dark" value={form.code}
              onChange={(v) => updateField('code', v || '')}
              options={{ readOnly: !editMode, minimap: { enabled: false }, fontSize: 14, fontFamily: "'JetBrains Mono', monospace", padding: { top: 16 }, scrollBeyondLastLine: false }} />
          </div>
        </TabsContent>
        <TabsContent value="config" className="flex-1 p-4 space-y-4 overflow-auto">
          <div className="grid gap-4 max-w-2xl">
            <div><Label>Agent名称</Label><Input value={form.name} onChange={(e) => updateField('name', e.target.value)} disabled={!editMode} /></div>
            <div><Label>描述</Label><Input value={form.description} onChange={(e) => updateField('description', e.target.value)} disabled={!editMode} /></div>
            <div><Label>系统提示词</Label><Textarea value={form.system_prompt} onChange={(e) => updateField('system_prompt', e.target.value)} disabled={!editMode} rows={4} /></div>
            <div><Label>默认模型</Label><ModelSelect value={form.model} onChange={(v) => updateField('model', v)} disabled={!editMode} /></div>
          </div>
        </TabsContent>
        <TabsContent value="test" className="flex-1 p-4 overflow-auto">
          <div className="max-w-2xl space-y-4">
            <div className="space-y-2">
              <Label>输入内容</Label>
              <Textarea value={testInput} onChange={(e) => setTestInput(e.target.value)} placeholder="输入要发送给Agent的内容..." rows={3} />
              <Button onClick={runAgent} disabled={testRunning || !testInput.trim()} className="w-full">
                {testRunning ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> 执行中...</> : <><Play className="w-4 h-4 mr-2" /> 运行Agent</>}
              </Button>
            </div>
            {testOutput && (
              <div className="space-y-2">
                <Label>输出结果</Label>
                <div className="bg-secondary/50 border border-border rounded-lg p-4 text-sm whitespace-pre-wrap max-h-64 overflow-auto">{testOutput}</div>
              </div>
            )}
            {executions.length > 0 && (
              <div className="space-y-2">
                <Label>执行历史</Label>
                <div className="space-y-2">{executions.map((e) => <ExecutionItem key={e.id} exec={e} />)}</div>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---------- Main Component ----------

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadAgents(); }, []);

  const loadAgents = async () => {
    const res = await client.entities.agents.query({ sort: '-created_at', limit: 50 });
    setAgents(res.data?.items || []);
    setLoading(false);
  };

  const updateField = (key: string, value: string) => setForm({ ...form, [key]: value });

  const createAgent = async () => {
    if (!form.name.trim()) { toast.error('请输入Agent名称'); return; }
    await client.entities.agents.create({ data: { ...form, status: 'draft' } });
    toast.success('Agent创建成功');
    setIsCreating(false);
    setForm(EMPTY_FORM);
    loadAgents();
  };

  if (selectedAgent) {
    return <AgentDetailView agent={selectedAgent} onBack={() => setSelectedAgent(null)} onRefresh={loadAgents} />;
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bot className="w-6 h-6 text-purple-400" /> AI Agent
          </h1>
          <p className="text-muted-foreground text-sm mt-1">创建和管理智能Agent，自动化处理各类任务</p>
        </div>
        <Button onClick={() => setIsCreating(true)}><Plus className="w-4 h-4 mr-2" /> 创建Agent</Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      ) : agents.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Bot className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">暂无Agent</h3>
            <p className="text-sm text-muted-foreground mb-4">点击"创建Agent"开始构建你的第一个智能助手</p>
            <Button onClick={() => setIsCreating(true)}><Plus className="w-4 h-4 mr-2" /> 创建Agent</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {agents.map((agent, i) => (
            <AgentCard key={agent.id} agent={agent} index={i} onSelect={() => setSelectedAgent(agent)} />
          ))}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={isCreating} onOpenChange={setIsCreating}>
        <DialogContent>
          <DialogHeader><DialogTitle>创建新Agent</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>名称 *</Label><Input value={form.name} onChange={(e) => updateField('name', e.target.value)} placeholder="输入Agent名称" /></div>
            <div><Label>描述</Label><Input value={form.description} onChange={(e) => updateField('description', e.target.value)} placeholder="简要描述Agent功能" /></div>
            <div><Label>系统提示词</Label><Textarea value={form.system_prompt} onChange={(e) => updateField('system_prompt', e.target.value)} placeholder="设置Agent的系统提示词" rows={3} /></div>
            <div><Label>默认模型</Label><ModelSelect value={form.model} onChange={(v) => updateField('model', v)} disabled={false} /></div>
            <Button onClick={createAgent} className="w-full">创建Agent</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}