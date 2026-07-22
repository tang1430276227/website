import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Bot, Zap, Puzzle, Shield, ArrowRight, Sparkles } from 'lucide-react';

export default function LandingPage() {
  const navigate = useNavigate();

  // Auto-redirect to dashboard since no auth needed
  useEffect(() => {
    navigate('/app');
  }, [navigate]);

  const goToDashboard = () => navigate('/app');

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              LLM Gateway
            </span>
          </div>
          <Button onClick={goToDashboard} className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
            进入平台
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-6 py-24 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 mb-8">
          <Zap className="w-4 h-4 text-blue-400" />
          <span className="text-sm text-blue-300">企业级多模型AI平台</span>
        </div>
        <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
          <span className="bg-gradient-to-r from-white via-blue-100 to-purple-200 bg-clip-text text-transparent">
            统一接入全球顶级
          </span>
          <br />
          <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            大语言模型
          </span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-12">
          一站式AI应用平台，支持多模型对话、AI Agent编排、MCP工具扩展，
          为企业提供可扩展的集群化部署方案
        </p>
        <div className="flex items-center justify-center gap-4">
          <Button
            size="lg"
            onClick={goToDashboard}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-lg px-8 py-6"
          >
            开始使用 <ArrowRight className="ml-2 w-5 h-5" />
          </Button>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { icon: Bot, title: '多模型对话', desc: '支持OpenAI、Anthropic、Google、DeepSeek等主流模型，一键切换' },
            { icon: Puzzle, title: 'AI Agent', desc: '在线编辑Agent代码，可视化工作流编排，支持复杂任务自动化' },
            { icon: Zap, title: 'MCP工具扩展', desc: '内置常用MCP工具，支持自定义MCP Server注册，无限扩展能力' },
            { icon: Shield, title: '企业级架构', desc: '微服务集群部署，Redis缓存、消息队列，支持百万级并发' },
          ].map((feature, i) => (
            <div
              key={i}
              className="p-6 rounded-xl bg-card border border-border hover:border-blue-500/50 transition-all duration-300 group"
            >
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center mb-4 group-hover:from-blue-500/30 group-hover:to-purple-500/30 transition-all">
                <feature.icon className="w-6 h-6 text-blue-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
              <p className="text-sm text-muted-foreground">{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8">
        <div className="max-w-7xl mx-auto px-6 text-center text-sm text-muted-foreground">
          © 2026 LLM Gateway Platform. 支持集群化部署，水平扩展至百万级用户。
        </div>
      </footer>
    </div>
  );
}