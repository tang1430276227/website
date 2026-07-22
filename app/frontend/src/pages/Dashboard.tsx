import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { client } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { MessageSquare, Bot, GitBranch, Puzzle, Plus, ArrowRight, Activity } from 'lucide-react';

// ---------- Constants ----------

const STAT_CONFIG = [
  { key: 'conversations', icon: MessageSquare, label: '对话', color: 'from-blue-500 to-cyan-500', path: '/app/chat' },
  { key: 'agents', icon: Bot, label: 'AI Agent', color: 'from-purple-500 to-pink-500', path: '/app/agents' },
  { key: 'workflows', icon: GitBranch, label: '工作流', color: 'from-emerald-500 to-teal-500', path: '/app/workflows' },
  { key: 'mcpTools', icon: Puzzle, label: 'MCP工具', color: 'from-orange-500 to-amber-500', path: '/app/mcp-tools' },
];

const QUICK_ACTIONS = [
  { icon: Plus, label: '新建对话', desc: '开始与AI模型对话', path: '/app/chat' },
  { icon: Bot, label: '创建Agent', desc: '编写自定义AI Agent', path: '/app/agents' },
  { icon: GitBranch, label: '编排工作流', desc: '可视化构建AI工作流', path: '/app/workflows' },
  { icon: Puzzle, label: '注册MCP工具', desc: '扩展平台能力', path: '/app/mcp-tools' },
];

// ---------- Entity-to-stats mapping ----------

const ENTITY_KEYS = ['conversations', 'agents', 'workflows', 'mcp_tools'] as const;
const STAT_KEYS = ['conversations', 'agents', 'workflows', 'mcpTools'] as const;

// ---------- Sub-components ----------

function StatCard({ stat, value, loading, onClick }: { stat: typeof STAT_CONFIG[0]; value: number; loading: boolean; onClick: () => void }) {
  return (
    <Card className="cursor-pointer hover:border-blue-500/50 transition-all group" onClick={onClick}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground mb-1">{stat.label}</p>
            {loading ? <Skeleton className="h-9 w-16 mt-1" /> : <p className="text-3xl font-bold">{value}</p>}
          </div>
          <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center opacity-80 group-hover:opacity-100 transition-opacity`}>
            <stat.icon className="w-6 h-6 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function QuickActionCard({ action, onClick }: { action: typeof QUICK_ACTIONS[0]; onClick: () => void }) {
  return (
    <Card className="cursor-pointer hover:border-blue-500/50 transition-all group" onClick={onClick}>
      <CardContent className="p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
            <action.icon className="w-5 h-5 text-blue-400" />
          </div>
          <ArrowRight className="w-4 h-4 text-muted-foreground ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
        <h3 className="font-medium mb-1">{action.label}</h3>
        <p className="text-xs text-muted-foreground">{action.desc}</p>
      </CardContent>
    </Card>
  );
}

// ---------- Main Component ----------

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<Record<string, number>>({ conversations: 0, agents: 0, workflows: 0, mcpTools: 0 });
  const [loading, setLoading] = useState(true);
  const [usageStats, setUsageStats] = useState({ total_tokens: 0, request_count: 0 });

  useEffect(() => { loadAllData(); }, []);

  const loadAllData = async () => {
    // All requests in parallel for fastest load
    const [convRes, agentRes, wfRes, mcpRes, usageRes] = await Promise.all([
      client.entities.conversations.query({ limit: 1 }),
      client.entities.agents.query({ limit: 1 }),
      client.entities.workflows.query({ limit: 1 }),
      client.entities.mcp_tools.query({ limit: 1 }),
      client.apiCall.invoke({ url: '/api/v1/gateway/usage', method: 'GET' }).catch(() => ({ data: null })),
    ]);
    const results = [convRes, agentRes, wfRes, mcpRes];
    const newStats: Record<string, number> = {};
    STAT_KEYS.forEach((key, i) => { newStats[key] = results[i].data?.total || 0; });
    setStats(newStats);
    if (usageRes.data) setUsageStats(usageRes.data);
    setLoading(false);
  };

  return (
    <div className="p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold mb-1">我的空间</h1>
        <p className="text-muted-foreground">管理您的AI应用和工作流</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {STAT_CONFIG.map((stat) => (
          <StatCard key={stat.key} stat={stat} value={stats[stat.key] || 0} loading={loading} onClick={() => navigate(stat.path)} />
        ))}
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-4">快速操作</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {QUICK_ACTIONS.map((action) => (
            <QuickActionCard key={action.label} action={action} onClick={() => navigate(action.path)} />
          ))}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="w-5 h-5 text-emerald-400" /> 系统状态
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <ServiceStatus label="API网关" status="运行中" />
            <ServiceStatus label="认证服务" status="运行中" />
            <ServiceStatus label="对话服务" status="运行中" />
            <ServiceStatus label="Agent引擎" status="运行中" />
          </div>
          <div className="mt-4 pt-4 border-t border-border grid grid-cols-2 gap-4">
            <div className="text-sm">
              <span className="text-muted-foreground">总API调用: </span>
              <span className="font-medium">{usageStats.request_count}</span>
            </div>
            <div className="text-sm">
              <span className="text-muted-foreground">总Token消耗: </span>
              <span className="font-medium">{usageStats.total_tokens.toLocaleString()}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ServiceStatus({ label, status }: { label: string; status: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
      <span className="text-sm">{label}</span>
      <Badge variant="outline" className="ml-auto text-[10px] text-emerald-400 border-emerald-400/30">{status}</Badge>
    </div>
  );
}