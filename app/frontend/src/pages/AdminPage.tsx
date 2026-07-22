import { useState, useEffect, useRef, useCallback } from 'react';
import { client } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Key, Server, Users, BarChart3, Trash2, Shield, Copy, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

// ---------- Types & Constants ----------

interface ApiKey {
  id: number; name: string; key_prefix: string; is_active: boolean;
  usage_count: number; last_used_at: string; created_at: string;
}

interface ModelProvider {
  id: number; name: string; api_type: string; base_url: string; models: string; is_active: boolean;
}

interface UsageStats {
  total_tokens: number; total_cost: number; request_count: number;
}

const API_TYPE_OPTIONS = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'google', label: 'Google' },
  { value: 'deepseek', label: 'DeepSeek' },
  { value: 'zhipu', label: '智谱AI' },
  { value: 'qwen', label: '通义千问' },
  { value: 'custom', label: '自定义(OpenAI兼容)' },
];

const EMPTY_PROVIDER = { name: '', api_type: 'openai', base_url: '', api_key_encrypted: '', models: '' };

// ---------- Sub-components ----------

function TableSkeleton({ cols, rows = 3 }: { cols: number; rows?: number }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {Array.from({ length: cols }).map((_, i) => (
            <TableHead key={i}><Skeleton className="h-4 w-20" /></TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from({ length: rows }).map((_, r) => (
          <TableRow key={r}>
            {Array.from({ length: cols }).map((_, c) => (
              <TableCell key={c}><Skeleton className="h-4 w-full" /></TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function ApiKeyTable({ keys, onDelete, onCopy, deletingId }: { keys: ApiKey[]; onDelete: (id: number) => void; onCopy: (prefix: string) => void; deletingId: number | null }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>名称</TableHead><TableHead>Key前缀</TableHead><TableHead>状态</TableHead>
          <TableHead>使用次数</TableHead><TableHead>创建时间</TableHead><TableHead>操作</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {keys.map((key) => (
          <TableRow key={key.id} className={deletingId === key.id ? 'opacity-50' : ''}>
            <TableCell className="font-medium">{key.name}</TableCell>
            <TableCell className="font-mono text-sm">
              <span className="flex items-center gap-1">
                {key.key_prefix}...
                <button onClick={() => onCopy(key.key_prefix)} className="hover:text-blue-400"><Copy className="w-3 h-3" /></button>
              </span>
            </TableCell>
            <TableCell><Badge variant={key.is_active ? 'default' : 'secondary'}>{key.is_active ? '活跃' : '已禁用'}</Badge></TableCell>
            <TableCell>{key.usage_count}</TableCell>
            <TableCell className="text-sm text-muted-foreground">{key.created_at ? new Date(key.created_at).toLocaleDateString() : '-'}</TableCell>
            <TableCell>
              <Button size="icon" variant="ghost" onClick={() => onDelete(key.id)} disabled={deletingId === key.id}>
                {deletingId === key.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4 text-destructive" />}
              </Button>
            </TableCell>
          </TableRow>
        ))}
        {keys.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">暂无API密钥</TableCell></TableRow>}
      </TableBody>
    </Table>
  );
}

function ProviderTable({ providers, onDelete, deletingId }: { providers: ModelProvider[]; onDelete: (id: number) => void; deletingId: number | null }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>名称</TableHead><TableHead>类型</TableHead><TableHead>API地址</TableHead>
          <TableHead>模型列表</TableHead><TableHead>状态</TableHead><TableHead>操作</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {providers.map((p) => (
          <TableRow key={p.id} className={deletingId === p.id ? 'opacity-50' : ''}>
            <TableCell className="font-medium">{p.name}</TableCell>
            <TableCell><Badge variant="outline">{p.api_type}</Badge></TableCell>
            <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{p.base_url}</TableCell>
            <TableCell className="text-sm text-muted-foreground max-w-[150px] truncate">{p.models || '-'}</TableCell>
            <TableCell><Badge variant={p.is_active ? 'default' : 'secondary'}>{p.is_active ? '启用' : '禁用'}</Badge></TableCell>
            <TableCell>
              <Button size="icon" variant="ghost" onClick={() => onDelete(p.id)} disabled={deletingId === p.id}>
                {deletingId === p.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4 text-destructive" />}
              </Button>
            </TableCell>
          </TableRow>
        ))}
        {providers.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">暂无模型厂商配置</TableCell></TableRow>}
      </TableBody>
    </Table>
  );
}

function UsageStatsGrid({ stats, loading }: { stats: UsageStats; loading: boolean }) {
  const cards = [
    { icon: BarChart3, label: '总请求数', value: stats.request_count, color: 'from-blue-500 to-cyan-500' },
    { icon: Users, label: '总Token消耗', value: stats.total_tokens.toLocaleString(), color: 'from-purple-500 to-pink-500' },
    { icon: Server, label: '总消费(Credits)', value: stats.total_cost.toFixed(2), color: 'from-emerald-500 to-teal-500' },
  ];
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {cards.map((stat) => (
        <Card key={stat.label}>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center`}>
                {loading ? <Loader2 className="w-6 h-6 text-white animate-spin" /> : <stat.icon className="w-6 h-6 text-white" />}
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <p className="text-2xl font-bold">{loading ? '...' : stat.value}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ---------- Main Component ----------

export default function AdminPage() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [providers, setProviders] = useState<ModelProvider[]>([]);
  const [isCreatingKey, setIsCreatingKey] = useState(false);
  const [isCreatingProvider, setIsCreatingProvider] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [providerForm, setProviderForm] = useState(EMPTY_PROVIDER);
  const [usageStats, setUsageStats] = useState<UsageStats>({ total_tokens: 0, total_cost: 0, request_count: 0 });
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingKeys, setLoadingKeys] = useState(true);
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [creatingKey, setCreatingKey] = useState(false);
  const [creatingProvider, setCreatingProvider] = useState(false);
  const [deletingKeyId, setDeletingKeyId] = useState<number | null>(null);
  const [deletingProviderId, setDeletingProviderId] = useState<number | null>(null);

  // Cache: track if data has been loaded at least once
  const cacheRef = useRef({ keys: false, providers: false, stats: false });

  // Parallel initial load
  useEffect(() => { loadAllData(); }, []);

  const loadAllData = async () => {
    const [keysRes, providersRes, statsRes] = await Promise.all([
      client.entities.api_keys.query({ sort: '-created_at', limit: 50 }),
      client.entities.model_providers.query({ sort: '-created_at', limit: 50 }),
      client.apiCall.invoke({ url: '/api/v1/gateway/usage', method: 'GET' }).catch(() => ({ data: null })),
    ]);
    setApiKeys(keysRes.data?.items || []);
    setProviders(providersRes.data?.items || []);
    setUsageStats(statsRes.data || { total_tokens: 0, total_cost: 0, request_count: 0 });
    setLoadingKeys(false);
    setLoadingProviders(false);
    setLoadingStats(false);
    cacheRef.current = { keys: true, providers: true, stats: true };
  };

  const loadApiKeys = useCallback(async () => {
    const res = await client.entities.api_keys.query({ sort: '-created_at', limit: 50 });
    setApiKeys(res.data?.items || []);
  }, []);

  const loadProviders = useCallback(async () => {
    const res = await client.entities.model_providers.query({ sort: '-created_at', limit: 50 });
    setProviders(res.data?.items || []);
  }, []);

  const createApiKey = async () => {
    if (!newKeyName.trim()) { toast.error('请输入Key名称'); return; }
    setCreatingKey(true);
    const keyValue = `sk-${crypto.randomUUID().replace(/-/g, '').slice(0, 32)}`;
    await client.entities.api_keys.create({
      data: { name: newKeyName, key_prefix: keyValue.slice(0, 8), key_hash: keyValue, is_active: true, usage_count: 0 },
    });
    toast.success('API Key创建成功');
    toast.info(`Key: ${keyValue}`, { duration: 10000 });
    navigator.clipboard.writeText(keyValue);
    toast.success('已复制到剪贴板');
    setIsCreatingKey(false);
    setNewKeyName('');
    setCreatingKey(false);
    loadApiKeys();
  };

  const deleteApiKey = (id: number) => {
    // Optimistic UI
    const previousKeys = apiKeys;
    setApiKeys((prev) => prev.filter((k) => k.id !== id));
    setDeletingKeyId(id);
    toast.success('API Key已删除');

    client.entities.api_keys.delete({ id: String(id) }).catch(() => {
      setApiKeys(previousKeys);
      toast.error('删除失败，已恢复');
    }).finally(() => setDeletingKeyId(null));
  };

  const copyKeyPrefix = (prefix: string) => {
    navigator.clipboard.writeText(prefix);
    toast.success('已复制Key前缀');
  };

  const createProvider = async () => {
    if (!providerForm.name.trim() || !providerForm.base_url.trim()) { toast.error('请填写名称和API地址'); return; }
    setCreatingProvider(true);
    await client.entities.model_providers.create({ data: { ...providerForm, is_active: true } });
    toast.success('模型厂商添加成功');
    setIsCreatingProvider(false);
    setProviderForm(EMPTY_PROVIDER);
    setCreatingProvider(false);
    loadProviders();
  };

  const deleteProvider = (id: number) => {
    // Optimistic UI
    const previousProviders = providers;
    setProviders((prev) => prev.filter((p) => p.id !== id));
    setDeletingProviderId(id);
    toast.success('模型厂商已删除');

    client.entities.model_providers.delete({ id: String(id) }).catch(() => {
      setProviders(previousProviders);
      toast.error('删除失败，已恢复');
    }).finally(() => setDeletingProviderId(null));
  };

  const updateProviderField = (key: string, value: string) => setProviderForm({ ...providerForm, [key]: value });

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Shield className="w-6 h-6 text-blue-400" /> 管理面板</h1>
        <p className="text-muted-foreground text-sm mt-1">管理API密钥、模型厂商配置和系统设置</p>
      </div>

      <Tabs defaultValue="keys">
        <TabsList>
          <TabsTrigger value="keys"><Key className="w-4 h-4 mr-1" /> API密钥管理</TabsTrigger>
          <TabsTrigger value="providers"><Server className="w-4 h-4 mr-1" /> 模型厂商</TabsTrigger>
          <TabsTrigger value="usage"><BarChart3 className="w-4 h-4 mr-1" /> 用量统计</TabsTrigger>
        </TabsList>

        <TabsContent value="keys" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">API密钥</CardTitle>
              <Button size="sm" onClick={() => setIsCreatingKey(true)}><Plus className="w-4 h-4 mr-1" /> 创建密钥</Button>
            </CardHeader>
            <CardContent>
              {loadingKeys ? <TableSkeleton cols={6} rows={3} /> : <ApiKeyTable keys={apiKeys} onDelete={deleteApiKey} onCopy={copyKeyPrefix} deletingId={deletingKeyId} />}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="providers" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">模型厂商配置</CardTitle>
              <Button size="sm" onClick={() => setIsCreatingProvider(true)}><Plus className="w-4 h-4 mr-1" /> 添加厂商</Button>
            </CardHeader>
            <CardContent>
              {loadingProviders ? <TableSkeleton cols={6} rows={3} /> : <ProviderTable providers={providers} onDelete={deleteProvider} deletingId={deletingProviderId} />}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="usage" className="mt-4"><UsageStatsGrid stats={usageStats} loading={loadingStats} /></TabsContent>
      </Tabs>

      {/* Create Key dialog */}
      <Dialog open={isCreatingKey} onOpenChange={setIsCreatingKey}>
        <DialogContent>
          <DialogHeader><DialogTitle>创建API密钥</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>密钥名称 *</Label><Input value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} placeholder="例如: 生产环境密钥" /></div>
            <Button onClick={createApiKey} className="w-full" disabled={creatingKey}>
              {creatingKey ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> 创建中...</> : '创建并复制'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Provider dialog */}
      <Dialog open={isCreatingProvider} onOpenChange={setIsCreatingProvider}>
        <DialogContent>
          <DialogHeader><DialogTitle>添加模型厂商</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>厂商名称 *</Label><Input value={providerForm.name} onChange={(e) => updateProviderField('name', e.target.value)} placeholder="例如: OpenAI" /></div>
            <div>
              <Label>API类型</Label>
              <Select value={providerForm.api_type} onValueChange={(v) => updateProviderField('api_type', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{API_TYPE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>API Base URL *</Label><Input value={providerForm.base_url} onChange={(e) => updateProviderField('base_url', e.target.value)} placeholder="https://api.openai.com/v1" /></div>
            <div><Label>API Key</Label><Input type="password" value={providerForm.api_key_encrypted} onChange={(e) => updateProviderField('api_key_encrypted', e.target.value)} placeholder="sk-..." /></div>
            <div><Label>可用模型 (逗号分隔)</Label><Input value={providerForm.models} onChange={(e) => updateProviderField('models', e.target.value)} placeholder="gpt-4, gpt-3.5-turbo" /></div>
            <Button onClick={createProvider} className="w-full" disabled={creatingProvider}>
              {creatingProvider ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> 添加中...</> : '添加'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}