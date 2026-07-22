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
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Puzzle, Trash2, ExternalLink, CheckCircle, Globe, Loader2, Wifi, Zap, Sparkles, Code, Database } from 'lucide-react';
import { toast } from 'sonner';

// ---------- Types & Constants ----------

interface McpTool {
  id: number; name: string; description: string; server_url: string;
  auth_type: string; auth_config: string; tools_schema: string; is_active: boolean; created_at: string;
}

interface DiscoveredTool {
  name: string;
  description?: string;
  inputSchema?: any;
}

const BUILTIN_TOOLS = [
  { name: 'Web Search', desc: '网页搜索工具，获取实时信息和最新数据', icon: Globe, gradient: 'from-blue-500 to-cyan-600', highlights: ['实时搜索', '多引擎', '结构化结果'] },
  { name: 'Code Interpreter', desc: '代码执行环境，支持Python运行时和数据分析', icon: Code, gradient: 'from-purple-500 to-pink-600', highlights: ['Python执行', '数据分析', '可视化'] },
  { name: 'File Manager', desc: '文件读写操作工具，支持多种格式的文件处理', icon: Puzzle, gradient: 'from-emerald-500 to-teal-600', highlights: ['文件读写', '格式转换', '批量操作'] },
  { name: 'Database Query', desc: '数据库查询工具，支持SQL查询和数据操作', icon: Database, gradient: 'from-orange-500 to-red-600', highlights: ['SQL查询', '数据导出', '表管理'] },
];

const AUTH_OPTIONS = [
  { value: 'none', label: '无认证' },
  { value: 'bearer', label: 'Bearer Token' },
  { value: 'api_key', label: 'API Key' },
  { value: 'oauth', label: 'OAuth 2.0' },
];

const EMPTY_FORM = { name: '', description: '', server_url: '', auth_type: 'none', auth_config: '', tools_schema: '' };

// ---------- Sub-components ----------

function BuiltinToolCard({ tool, index = 0 }: { tool: typeof BUILTIN_TOOLS[0]; index?: number }) {
  return (
    <Card className="group hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/10 transition-all duration-300 animate-slide-in"
      style={{ animationDelay: `${index * 100}ms` }}>
      <CardContent className="p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${tool.gradient} flex items-center justify-center`}>
            <tool.icon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-lg group-hover:text-blue-400 transition-colors">{tool.name}</h3>
            <Badge variant="outline" className="text-xs text-emerald-400 border-emerald-400/30">
              <CheckCircle className="w-3 h-3 mr-1" /> 已启用
            </Badge>
          </div>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">{tool.desc}</p>
        <div className="flex flex-wrap gap-2">
          {tool.highlights.map((h) => (
            <Badge key={h} variant="secondary" className="text-xs font-normal">
              <Sparkles className="w-3 h-3 mr-1" />{h}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function CustomToolCard({ tool, onToggle, onDelete, onDiscover, onPing, discovering, pinging, deleting, index = 0 }: {
  tool: McpTool; onToggle: () => void; onDelete: () => void;
  onDiscover: () => void; onPing: () => void; discovering: boolean; pinging: boolean; deleting: boolean; index?: number;
}) {
  const toolCount = parseToolCount(tool.tools_schema);
  return (
    <Card className={`group hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/10 transition-all duration-300 animate-slide-in ${deleting ? 'opacity-50 pointer-events-none' : ''}`}
      style={{ animationDelay: `${index * 100}ms` }}>
      <CardContent className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
              <Puzzle className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-lg group-hover:text-blue-400 transition-colors">{tool.name}</h3>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">{tool.auth_type}</Badge>
                {toolCount > 0 && <Badge variant="secondary" className="text-xs">{toolCount} 工具</Badge>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={tool.is_active} onCheckedChange={onToggle} />
            <Button size="icon" variant="ghost" onClick={onDelete} disabled={deleting}>
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4 text-destructive" />}
            </Button>
          </div>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">{tool.description || '自定义MCP Server'}</p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <ExternalLink className="w-3 h-3" />
          <span className="truncate">{tool.server_url}</span>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={onPing} disabled={pinging} className="flex-1">
            {pinging ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Wifi className="w-3 h-3 mr-1" />}
            {pinging ? '连接中...' : '测试连接'}
          </Button>
          <Button size="sm" variant="outline" onClick={onDiscover} disabled={discovering} className="flex-1">
            {discovering ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Zap className="w-3 h-3 mr-1" />}
            发现工具
          </Button>
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

// ---------- Main Component ----------

export default function McpToolsPage() {
  const [tools, setTools] = useState<McpTool[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [discoveringId, setDiscoveringId] = useState<number | null>(null);
  const [pingingId, setPingingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [discoveredTools, setDiscoveredTools] = useState<DiscoveredTool[]>([]);
  const [showDiscovered, setShowDiscovered] = useState(false);
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadTools(); }, []);

  const loadTools = async () => {
    const res = await client.entities.mcp_tools.query({ sort: '-created_at', limit: 50 });
    setTools(res.data?.items || []);
    setLoading(false);
  };

  const updateField = (key: string, value: string) => setForm({ ...form, [key]: value });

  const createTool = async () => {
    if (!form.name.trim() || !form.server_url.trim()) { toast.error('请填写名称和服务器URL'); return; }
    setCreating(true);
    await client.entities.mcp_tools.create({ data: { ...form, is_active: true } });
    toast.success('MCP工具注册成功');
    setIsCreating(false);
    setForm(EMPTY_FORM);
    setCreating(false);
    loadTools();
  };

  const deleteTool = (id: number) => {
    const previousTools = tools;
    setTools((prev) => prev.filter((t) => t.id !== id));
    setDeletingId(id);
    toast.success('MCP工具已删除');
    client.entities.mcp_tools.delete({ id: String(id) }).catch(() => {
      setTools(previousTools);
      toast.error('删除失败，已恢复');
    }).finally(() => setDeletingId(null));
  };

  const toggleTool = (tool: McpTool) => {
    const previousTools = tools;
    setTools((prev) => prev.map((t) => t.id === tool.id ? { ...t, is_active: !t.is_active } : t));
    toast.success(tool.is_active ? '已禁用' : '已启用');
    client.entities.mcp_tools.update({ id: String(tool.id), data: { is_active: !tool.is_active } }).catch(() => {
      setTools(previousTools);
      toast.error('操作失败，已恢复');
    });
  };

  const pingServer = async (toolId: number) => {
    setPingingId(toolId);
    const res = await client.apiCall.invoke({ url: `/api/v1/mcp/ping/${toolId}`, method: 'POST' });
    if (res.data?.status === 'connected') toast.success('连接成功');
    else toast.error('连接失败');
    setPingingId(null);
  };

  const discoverTools = async (toolId: number) => {
    setDiscoveringId(toolId);
    const res = await client.apiCall.invoke({ url: `/api/v1/mcp/discover/${toolId}`, method: 'POST' });
    setDiscoveredTools(res.data?.tools || []);
    setShowDiscovered(true);
    toast.success(`发现 ${res.data?.count || 0} 个工具`);
    setDiscoveringId(null);
    loadTools();
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Puzzle className="w-6 h-6 text-orange-400" /> MCP工具
          </h1>
          <p className="text-muted-foreground text-sm mt-1">管理内置工具和自定义MCP Server，扩展AI能力</p>
        </div>
        <Button onClick={() => setIsCreating(true)}><Plus className="w-4 h-4 mr-2" /> 注册MCP Server</Button>
      </div>

      {/* Built-in tools */}
      <section>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-emerald-400" /> 内置工具
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {BUILTIN_TOOLS.map((t, i) => <BuiltinToolCard key={t.name} tool={t} index={i} />)}
        </div>
      </section>

      {/* Custom tools */}
      <section>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Zap className="w-5 h-5 text-amber-400" /> 自定义MCP Server
        </h2>
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {Array.from({ length: 2 }).map((_, i) => <CardSkeleton key={i} />)}
          </div>
        ) : tools.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Puzzle className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-muted-foreground">暂无自定义MCP Server，点击右上角注册</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {tools.map((t, i) => (
              <CustomToolCard key={t.id} tool={t} index={i}
                onToggle={() => toggleTool(t)} onDelete={() => deleteTool(t.id)}
                onDiscover={() => discoverTools(t.id)} onPing={() => pingServer(t.id)}
                discovering={discoveringId === t.id} pinging={pingingId === t.id}
                deleting={deletingId === t.id} />
            ))}
          </div>
        )}
      </section>

      {/* Create dialog */}
      <Dialog open={isCreating} onOpenChange={setIsCreating}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>注册MCP Server</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>名称 *</Label><Input value={form.name} onChange={(e) => updateField('name', e.target.value)} placeholder="MCP Server名称" /></div>
            <div><Label>描述</Label><Input value={form.description} onChange={(e) => updateField('description', e.target.value)} placeholder="简要描述工具功能" /></div>
            <div><Label>Server URL *</Label><Input value={form.server_url} onChange={(e) => updateField('server_url', e.target.value)} placeholder="https://your-mcp-server.com/sse" /></div>
            <div>
              <Label>认证方式</Label>
              <Select value={form.auth_type} onValueChange={(v) => updateField('auth_type', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{AUTH_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {form.auth_type !== 'none' && (
              <div><Label>认证配置 (JSON)</Label><Textarea value={form.auth_config} onChange={(e) => updateField('auth_config', e.target.value)} placeholder='{"token": "your-token"}' rows={3} className="font-mono text-sm" /></div>
            )}
            <Button onClick={createTool} className="w-full" disabled={creating}>
              {creating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> 注册中...</> : '注册'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Discovered tools dialog */}
      <Dialog open={showDiscovered} onOpenChange={setShowDiscovered}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>已发现的工具 ({discoveredTools.length})</DialogTitle></DialogHeader>
          <div className="space-y-2 max-h-96 overflow-auto">
            {discoveredTools.map((t, i) => (
              <div key={i} className="border border-border rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-400" />
                  <span className="font-medium text-sm">{t.name}</span>
                </div>
                {t.description && <p className="text-xs text-muted-foreground mt-1">{t.description}</p>}
              </div>
            ))}
            {discoveredTools.length === 0 && <p className="text-center text-muted-foreground py-4">未发现任何工具</p>}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------- Utilities ----------

function parseToolCount(schema: string): number {
  if (!schema) return 0;
  const parsed = JSON.parse(schema || '[]');
  return Array.isArray(parsed) ? parsed.length : 0;
}