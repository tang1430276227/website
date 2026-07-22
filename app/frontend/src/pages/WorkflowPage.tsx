import { useState, useEffect, useCallback, useRef } from 'react';
import { client } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Save, Trash2, GitBranch, Bot, Wrench, MessageSquare, Loader2, ArrowLeft, Sparkles, Zap, Play, CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import {
  ReactFlow, MiniMap, Controls, Background,
  useNodesState, useEdgesState, addEdge,
  Connection, Node, Edge, BackgroundVariant, Handle, Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

// ---------- Types & Constants ----------

interface Workflow {
  id: number; name: string; description: string;
  nodes: string; edges: string; status: string; created_at: string;
}

interface Agent {
  id: number; name: string; description: string; model: string; status: string;
}

interface McpTool {
  id: number; name: string; description: string; is_active: boolean;
}

type NodeStatus = 'idle' | 'waiting' | 'running' | 'completed' | 'failed';

interface WorkflowNodeData {
  label: string;
  nodeType: string;
  agentId?: number;
  agentName?: string;
  toolId?: number;
  toolName?: string;
  status?: NodeStatus;
  output?: string;
}

const NODE_TYPE_CONFIG: Record<string, { label: string; icon: any; color: string; borderColor: string }> = {
  input: { label: '用户输入', icon: MessageSquare, color: 'from-blue-500 to-cyan-600', borderColor: 'hsl(217 91% 60%)' },
  agent: { label: 'AI Agent', icon: Bot, color: 'from-purple-500 to-pink-600', borderColor: 'hsl(270 91% 60%)' },
  tool: { label: 'MCP工具', icon: Wrench, color: 'from-amber-500 to-orange-600', borderColor: 'hsl(30 91% 50%)' },
  output: { label: '输出结果', icon: GitBranch, color: 'from-emerald-500 to-teal-600', borderColor: 'hsl(160 91% 40%)' },
};

const STATUS_STYLE_MAP: Record<NodeStatus, { border: string; shadow: string; icon: any; label: string }> = {
  idle: { border: '', shadow: '', icon: Clock, label: '空闲' },
  waiting: { border: 'border-yellow-500', shadow: 'shadow-yellow-500/20', icon: Clock, label: '等待中' },
  running: { border: 'border-blue-500', shadow: 'shadow-blue-500/30', icon: Loader2, label: '执行中' },
  completed: { border: 'border-emerald-500', shadow: 'shadow-emerald-500/30', icon: CheckCircle, label: '完成' },
  failed: { border: 'border-red-500', shadow: 'shadow-red-500/30', icon: XCircle, label: '失败' },
};

const EDGE_STYLE = { stroke: 'hsl(217 91% 60%)' };

const WORKFLOW_TYPES: { gradient: string; description: string; highlights: string[] }[] = [
  { gradient: 'from-blue-500 to-cyan-600', description: '自动化数据处理流程', highlights: ['数据清洗', '格式转换', '批量处理'] },
  { gradient: 'from-purple-500 to-pink-600', description: '多Agent协作工作流', highlights: ['多步推理', 'Agent协作', '任务编排'] },
  { gradient: 'from-emerald-500 to-teal-600', description: '智能决策工作流', highlights: ['条件分支', '规则引擎', '自动决策'] },
  { gradient: 'from-orange-500 to-red-600', description: '内容生成工作流', highlights: ['文案生成', '图文配合', '多渠道发布'] },
];

// ---------- Custom Node Component ----------

function CustomNode({ data }: { data: WorkflowNodeData }) {
  const config = NODE_TYPE_CONFIG[data.nodeType] || NODE_TYPE_CONFIG.output;
  const status = data.status || 'idle';
  const statusStyle = STATUS_STYLE_MAP[status];
  const StatusIcon = statusStyle.icon;

  return (
    <div className={`relative px-4 py-3 rounded-xl border-2 min-w-[180px] transition-all duration-300 ${status !== 'idle' ? statusStyle.border : 'border-border'} ${status !== 'idle' ? `shadow-lg ${statusStyle.shadow}` : ''}`}
      style={{ background: 'hsl(222 47% 11%)' }}>
      <Handle type="target" position={Position.Top} className="!bg-blue-500 !w-3 !h-3 !border-2 !border-background" />
      <div className="flex items-center gap-2">
        <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${config.color} flex items-center justify-center flex-shrink-0`}>
          <config.icon className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-foreground truncate">{data.label}</div>
          {data.agentName && <div className="text-[10px] text-muted-foreground truncate">Agent: {data.agentName}</div>}
          {data.toolName && <div className="text-[10px] text-muted-foreground truncate">工具: {data.toolName}</div>}
        </div>
        {status !== 'idle' && (
          <StatusIcon className={`w-4 h-4 flex-shrink-0 ${status === 'running' ? 'animate-spin text-blue-400' : status === 'completed' ? 'text-emerald-400' : status === 'failed' ? 'text-red-400' : 'text-yellow-400'}`} />
        )}
      </div>
      {data.output && status === 'completed' && (
        <div className="mt-2 text-[10px] text-emerald-300/80 bg-emerald-500/10 rounded p-1.5 max-h-16 overflow-auto whitespace-pre-wrap border border-emerald-500/20">
          {data.output.slice(0, 200)}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} className="!bg-blue-500 !w-3 !h-3 !border-2 !border-background" />
    </div>
  );
}

const nodeTypes = { custom: CustomNode };

// ---------- Sub-components ----------

function WorkflowCard({ wf, index, onSelect }: { wf: Workflow; index: number; onSelect: () => void }) {
  const typeInfo = WORKFLOW_TYPES[index % WORKFLOW_TYPES.length];
  const nodeCount = parseNodeCount(wf.nodes);
  return (
    <Card className="group cursor-pointer hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/10 transition-all duration-300 animate-slide-in"
      style={{ animationDelay: `${index * 100}ms` }} onClick={onSelect}>
      <CardContent className="p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${typeInfo.gradient} flex items-center justify-center`}>
            <GitBranch className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg group-hover:text-blue-400 transition-colors truncate">{wf.name}</h3>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">{nodeCount} 个节点</Badge>
              <Badge variant={wf.status === 'active' ? 'default' : 'secondary'} className="text-xs">{wf.status || 'draft'}</Badge>
            </div>
          </div>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">{wf.description || typeInfo.description}</p>
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

// ---------- Node Config Panel ----------

function NodeConfigPanel({ node, agents, mcpTools, onUpdate, onClose }: {
  node: Node; agents: Agent[]; mcpTools: McpTool[];
  onUpdate: (nodeId: string, data: Partial<WorkflowNodeData>) => void; onClose: () => void;
}) {
  const data = node.data as WorkflowNodeData;
  const [label, setLabel] = useState(data.label || '');
  const [agentId, setAgentId] = useState(String(data.agentId || ''));
  const [toolId, setToolId] = useState(String(data.toolId || ''));

  const handleSave = () => {
    const updates: Partial<WorkflowNodeData> = { label };
    if (data.nodeType === 'agent' && agentId) {
      const agent = agents.find((a) => a.id === Number(agentId));
      updates.agentId = Number(agentId);
      updates.agentName = agent?.name || '';
    }
    if (data.nodeType === 'tool' && toolId) {
      const tool = mcpTools.find((t) => t.id === Number(toolId));
      updates.toolId = Number(toolId);
      updates.toolName = tool?.name || '';
    }
    onUpdate(node.id, updates);
    onClose();
    toast.success('节点配置已更新');
  };

  return (
    <div className="absolute top-4 right-4 z-50 w-72 bg-card border border-border rounded-xl p-4 shadow-xl space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-sm">节点配置</h3>
        <Button variant="ghost" size="sm" onClick={onClose}>✕</Button>
      </div>
      <div>
        <Label className="text-xs">节点名称</Label>
        <Input value={label} onChange={(e) => setLabel(e.target.value)} className="mt-1" />
      </div>
      {data.nodeType === 'agent' && (
        <div>
          <Label className="text-xs">选择Agent</Label>
          <Select value={agentId} onValueChange={setAgentId}>
            <SelectTrigger className="mt-1"><SelectValue placeholder="选择一个Agent" /></SelectTrigger>
            <SelectContent>
              {agents.map((a) => (
                <SelectItem key={a.id} value={String(a.id)}>
                  <div className="flex items-center gap-2">
                    <Bot className="w-3 h-3" />
                    <span>{a.name}</span>
                    <Badge variant="outline" className="text-[10px] ml-1">{a.model}</Badge>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {data.nodeType === 'tool' && (
        <div>
          <Label className="text-xs">选择MCP工具</Label>
          <Select value={toolId} onValueChange={setToolId}>
            <SelectTrigger className="mt-1"><SelectValue placeholder="选择一个MCP工具" /></SelectTrigger>
            <SelectContent>
              {mcpTools.map((t) => (
                <SelectItem key={t.id} value={String(t.id)}>
                  <div className="flex items-center gap-2">
                    <Wrench className="w-3 h-3" />
                    <span>{t.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <Button onClick={handleSave} className="w-full" size="sm">保存配置</Button>
    </div>
  );
}

// ---------- Run Dialog ----------

function RunDialog({ open, onClose, onRun, hasInput, running }: {
  open: boolean; onClose: () => void; onRun: (input: string) => void; hasInput: boolean; running: boolean;
}) {
  const [input, setInput] = useState('');

  const handleRun = () => {
    onRun(input);
    setInput('');
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>运行工作流</DialogTitle></DialogHeader>
        <div className="space-y-4">
          {hasInput ? (
            <div>
              <Label>输入内容</Label>
              <Textarea value={input} onChange={(e) => setInput(e.target.value)}
                placeholder="请输入工作流的初始数据..." rows={4} className="mt-1" />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">该工作流没有输入节点，将直接开始执行。</p>
          )}
          <Button onClick={handleRun} className="w-full" disabled={running || (hasInput && !input.trim())}>
            {running ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> 执行中...</> : <><Play className="w-4 h-4 mr-2" /> 开始运行</>}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Editor View ----------

function WorkflowEditorView({ wf, onBack, onRefresh }: { wf: Workflow; onBack: () => void; onRefresh: () => void }) {
  const initialNodes = parseWorkflowNodes(wf.nodes);
  const initialEdges = parseJSON<Edge[]>(wf.edges, []);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [saving, setSaving] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [mcpTools, setMcpTools] = useState<McpTool[]>([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [showRunDialog, setShowRunDialog] = useState(false);
  const [running, setRunning] = useState(false);
  const runAbortRef = useRef(false);

  useEffect(() => {
    loadResources();
  }, []);

  const loadResources = async () => {
    const [agentsRes, toolsRes] = await Promise.all([
      client.entities.agents.query({ sort: '-created_at', limit: 100 }),
      client.entities.mcp_tools.query({ sort: '-created_at', limit: 100 }),
    ]);
    setAgents(agentsRes.data?.items || []);
    setMcpTools(toolsRes.data?.items || []);
  };

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({ ...params, animated: true, style: EDGE_STYLE }, eds)),
    [setEdges]
  );

  const addNode = (type: string) => {
    const config = NODE_TYPE_CONFIG[type];
    const newNode: Node = {
      id: `node-${Date.now()}`,
      type: 'custom',
      position: { x: Math.random() * 400 + 100, y: Math.random() * 300 + 100 },
      data: { label: config.label, nodeType: type, status: 'idle' } as WorkflowNodeData,
    };
    setNodes((nds) => [...nds, newNode]);
  };

  const updateNodeData = (nodeId: string, updates: Partial<WorkflowNodeData>) => {
    setNodes((nds) => nds.map((n) => n.id === nodeId ? { ...n, data: { ...n.data, ...updates } } : n));
  };

  const handleNodeClick = (_: any, node: Node) => {
    setSelectedNode(node);
  };

  const saveWorkflow = async () => {
    setSaving(true);
    const serializedNodes = JSON.stringify(nodes.map((n) => ({
      ...n, data: { ...n.data, status: 'idle', output: undefined },
    })));
    await client.entities.workflows.update({
      id: String(wf.id),
      data: { nodes: serializedNodes, edges: JSON.stringify(edges) },
    });
    toast.success('工作流已保存');
    setSaving(false);
    onRefresh();
  };

  const deleteWorkflow = () => {
    client.entities.workflows.delete({ id: String(wf.id) }).then(() => {
      toast.success('工作流已删除');
      onBack();
      onRefresh();
    }).catch(() => toast.error('删除失败'));
  };

  // ---------- Workflow Execution ----------

  const getExecutionOrder = (): string[] => {
    const adjacency: Record<string, string[]> = {};
    const inDegree: Record<string, number> = {};
    nodes.forEach((n) => { adjacency[n.id] = []; inDegree[n.id] = 0; });
    edges.forEach((e) => {
      adjacency[e.source]?.push(e.target);
      inDegree[e.target] = (inDegree[e.target] || 0) + 1;
    });
    // Topological sort (BFS)
    const queue = Object.keys(inDegree).filter((id) => inDegree[id] === 0);
    const order: string[] = [];
    while (queue.length > 0) {
      const curr = queue.shift()!;
      order.push(curr);
      for (const next of adjacency[curr] || []) {
        inDegree[next]--;
        if (inDegree[next] === 0) queue.push(next);
      }
    }
    return order;
  };

  const executeWorkflow = async (userInput: string) => {
    setShowRunDialog(false);
    setRunning(true);
    runAbortRef.current = false;

    const order = getExecutionOrder();
    // Reset all nodes to waiting
    setNodes((nds) => nds.map((n) => ({ ...n, data: { ...n.data, status: 'waiting', output: undefined } })));

    let currentOutput = userInput;

    for (const nodeId of order) {
      if (runAbortRef.current) break;
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) continue;
      const data = node.data as WorkflowNodeData;

      // Set current node to running
      setNodes((nds) => nds.map((n) => n.id === nodeId ? { ...n, data: { ...n.data, status: 'running' } } : n));

      await delay(800); // Simulate processing time for visual feedback

      const result = await executeNode(data, currentOutput);

      if (result.success) {
        currentOutput = result.output;
        setNodes((nds) => nds.map((n) => n.id === nodeId ? { ...n, data: { ...n.data, status: 'completed', output: result.output } } : n));
      } else {
        setNodes((nds) => nds.map((n) => n.id === nodeId ? { ...n, data: { ...n.data, status: 'failed', output: result.output } } : n));
        toast.error(`节点 "${data.label}" 执行失败`);
        break;
      }
    }

    setRunning(false);
    toast.success('工作流执行完成');
  };

  const executeNode = async (data: WorkflowNodeData, input: string): Promise<{ success: boolean; output: string }> => {
    const nodeType = data.nodeType;
    if (nodeType === 'input') {
      return { success: true, output: input || '(空输入)' };
    }
    if (nodeType === 'output') {
      return { success: true, output: input };
    }
    if (nodeType === 'agent') {
      if (!data.agentId) return { success: false, output: '未配置Agent' };
      try {
        const response = await client.apiCall.invoke({
          url: '/api/v1/agents/run',
          method: 'POST',
          data: { agent_id: data.agentId, input_text: input },
          options: { timeout: 120000 },
        });
        return { success: true, output: response.data?.output || '执行完成' };
      } catch {
        return { success: false, output: 'Agent执行出错' };
      }
    }
    if (nodeType === 'tool') {
      if (!data.toolId) return { success: false, output: '未配置MCP工具' };
      try {
        const response = await client.apiCall.invoke({
          url: '/api/v1/mcp/invoke',
          method: 'POST',
          data: { tool_id: data.toolId, input: input },
          options: { timeout: 60000 },
        });
        return { success: true, output: response.data?.result || '工具调用完成' };
      } catch {
        return { success: false, output: 'MCP工具调用出错' };
      }
    }
    return { success: true, output: input };
  };

  const hasInputNode = nodes.some((n) => (n.data as WorkflowNodeData).nodeType === 'input');

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      <div className="p-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="w-5 h-5" /></Button>
          <h2 className="font-medium">{wf.name}</h2>
          <Badge variant="outline">{wf.status || 'draft'}</Badge>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {Object.entries(NODE_TYPE_CONFIG).map(([type, info]) => (
            <Button key={type} size="sm" variant="outline" onClick={() => addNode(type)} title={`添加${info.label}节点`}>
              <info.icon className="w-4 h-4 mr-1" />{info.label}
            </Button>
          ))}
          <div className="w-px h-6 bg-border mx-1" />
          <Button size="sm" variant="default" onClick={() => setShowRunDialog(true)} disabled={running}
            className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700">
            {running ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Play className="w-4 h-4 mr-1" />}
            {running ? '运行中...' : '运行'}
          </Button>
          <Button size="sm" onClick={saveWorkflow} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
            {saving ? '保存中...' : '保存'}
          </Button>
          <Button size="sm" variant="destructive" onClick={deleteWorkflow}><Trash2 className="w-4 h-4" /></Button>
        </div>
      </div>
      <div className="flex-1 relative">
        <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
          onConnect={onConnect} onNodeClick={handleNodeClick} nodeTypes={nodeTypes}
          fitView style={{ background: 'hsl(222 47% 5%)' }}>
          <Controls className="!bg-card !border-border" />
          <MiniMap className="!bg-card !border-border" />
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="hsl(217 33% 20%)" />
        </ReactFlow>
        {selectedNode && (
          <NodeConfigPanel
            node={selectedNode} agents={agents} mcpTools={mcpTools}
            onUpdate={updateNodeData} onClose={() => setSelectedNode(null)}
          />
        )}
      </div>
      <RunDialog open={showRunDialog} onClose={() => setShowRunDialog(false)}
        onRun={executeWorkflow} hasInput={hasInputNode} running={running} />
    </div>
  );
}

// ---------- Main Component ----------

export default function WorkflowPage() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadWorkflows(); }, []);

  const loadWorkflows = async () => {
    const res = await client.entities.workflows.query({ sort: '-created_at', limit: 50 });
    setWorkflows(res.data?.items || []);
    setLoading(false);
  };

  const createWorkflow = async () => {
    if (!newName.trim()) { toast.error('请输入工作流名称'); return; }
    setCreating(true);
    const defaultNodes: Node[] = [
      { id: 'node-input', type: 'custom', position: { x: 250, y: 50 }, data: { label: '用户输入', nodeType: 'input', status: 'idle' } as WorkflowNodeData },
      { id: 'node-agent', type: 'custom', position: { x: 250, y: 200 }, data: { label: 'AI Agent处理', nodeType: 'agent', status: 'idle' } as WorkflowNodeData },
      { id: 'node-output', type: 'custom', position: { x: 250, y: 350 }, data: { label: '输出结果', nodeType: 'output', status: 'idle' } as WorkflowNodeData },
    ];
    const defaultEdges: Edge[] = [
      { id: 'e-input-agent', source: 'node-input', target: 'node-agent', animated: true, style: EDGE_STYLE },
      { id: 'e-agent-output', source: 'node-agent', target: 'node-output', animated: true, style: { stroke: 'hsl(270 91% 60%)' } },
    ];
    await client.entities.workflows.create({
      data: { name: newName, description: newDesc, nodes: JSON.stringify(defaultNodes), edges: JSON.stringify(defaultEdges), status: 'draft' },
    });
    toast.success('工作流创建成功');
    setIsCreating(false);
    setNewName('');
    setNewDesc('');
    setCreating(false);
    loadWorkflows();
  };

  if (selectedWorkflow) {
    return <WorkflowEditorView wf={selectedWorkflow} onBack={() => setSelectedWorkflow(null)} onRefresh={loadWorkflows} />;
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Zap className="w-6 h-6 text-emerald-400" /> 工作流编排
          </h1>
          <p className="text-muted-foreground text-sm mt-1">可视化编排AI工作流，自动化复杂任务</p>
        </div>
        <Button onClick={() => setIsCreating(true)}><Plus className="w-4 h-4 mr-2" /> 创建工作流</Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      ) : workflows.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <GitBranch className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">暂无工作流</h3>
            <p className="text-sm text-muted-foreground mb-4">点击"创建工作流"开始编排你的第一个自动化流程</p>
            <Button onClick={() => setIsCreating(true)}><Plus className="w-4 h-4 mr-2" /> 创建工作流</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {workflows.map((wf, i) => (
            <WorkflowCard key={wf.id} wf={wf} index={i} onSelect={() => setSelectedWorkflow(wf)} />
          ))}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={isCreating} onOpenChange={setIsCreating}>
        <DialogContent>
          <DialogHeader><DialogTitle>创建新工作流</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>名称 *</Label><Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="工作流名称" /></div>
            <div><Label>描述</Label><Input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="简要描述" /></div>
            <Button onClick={createWorkflow} className="w-full" disabled={creating}>
              {creating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> 创建中...</> : '创建'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------- Utilities ----------

function parseJSON<T>(str: string, fallback: T): T {
  if (!str) return fallback;
  try {
    const parsed = JSON.parse(str);
    return parsed || fallback;
  } catch {
    return fallback;
  }
}

function parseWorkflowNodes(nodesStr: string): Node[] {
  if (!nodesStr) return [];
  try {
    const parsed = JSON.parse(nodesStr);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((n: any) => ({
      ...n,
      type: 'custom',
      data: { ...n.data, status: 'idle', output: undefined },
    }));
  } catch {
    return [];
  }
}

function parseNodeCount(nodesStr: string): number {
  if (!nodesStr) return 3;
  try {
    const parsed = JSON.parse(nodesStr);
    return Array.isArray(parsed) ? parsed.length : 3;
  } catch {
    return 3;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}