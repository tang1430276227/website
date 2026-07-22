import { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { LayoutDashboard, MessageSquare, Bot, GitBranch, Puzzle, Settings, LogOut, ChevronLeft, ChevronRight, Sparkles, User, Image as ImageIcon, Gamepad2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// ---------- Constants ----------

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: '仪表盘', path: '/app' },
  { icon: ImageIcon, label: '模型体验', path: '/app/experience' },
  { icon: MessageSquare, label: '模型对话', path: '/app/chat' },
  { icon: Bot, label: 'AI Agent', path: '/app/agents' },
  { icon: GitBranch, label: '工作流编排', path: '/app/workflows' },
  { icon: Puzzle, label: 'MCP工具', path: '/app/mcp-tools' },
  { icon: Gamepad2, label: '游戏时间', path: '/app/games' },
  { icon: Settings, label: '管理面板', path: '/app/admin' },
];

// Routes that auto-collapse sidebar
const AUTO_COLLAPSE_ROUTES = ['/app/chat', '/app/agents'];

// ---------- Sub-components ----------

function SidebarLogo({ collapsed }: { collapsed: boolean }) {
  return (
    <div className="p-4 flex items-center gap-2 border-b border-border">
      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
        <Sparkles className="w-5 h-5 text-white" />
      </div>
      {!collapsed && (
        <span className="text-lg font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent truncate">
          LLM Gateway
        </span>
      )}
    </div>
  );
}

function NavItem({ item, isActive, collapsed, onClick }: {
  item: typeof NAV_ITEMS[0]; isActive: boolean; collapsed: boolean; onClick: () => void;
}) {
  return (
    <button onClick={onClick} className={cn(
      'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm',
      isActive ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
    )}>
      <item.icon className={cn('w-5 h-5 flex-shrink-0', isActive && 'text-blue-400')} />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </button>
  );
}

function TopBar({ onLogout }: { onLogout: () => void }) {
  return (
    <header className="h-14 border-b border-border flex items-center justify-end px-6 bg-background/80 backdrop-blur-sm sticky top-0 z-40">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="rounded-full">
            <Avatar className="w-8 h-8">
              <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-xs">
                <User className="w-4 h-4" />
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={onLogout} className="text-destructive">
            <LogOut className="w-4 h-4 mr-2" /> 退出登录
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}

// ---------- Route Matching ----------

function isNavActive(itemPath: string, currentPath: string): boolean {
  return currentPath === itemPath || (itemPath !== '/app' && currentPath.startsWith(itemPath));
}

// ---------- Main Component ----------

export default function DashboardLayout() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [hovered, setHovered] = useState(false);

  // Auto-collapse sidebar on certain routes
  useEffect(() => {
    const shouldCollapse = AUTO_COLLAPSE_ROUTES.some((r) => location.pathname.startsWith(r));
    if (shouldCollapse) setCollapsed(true);
  }, [location.pathname]);

  const handleNavClick = (path: string) => {
    navigate(path);
    setCollapsed(true);
  };

  // Sidebar is visually expanded when not collapsed OR when hovered while collapsed
  const isExpanded = !collapsed || hovered;

  return (
    <div className="min-h-screen flex bg-background">
      <aside
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={cn(
          'h-screen sticky top-0 border-r border-border bg-sidebar-background flex flex-col transition-all duration-300 z-50',
          isExpanded ? 'w-60' : 'w-16'
        )}
      >
        <SidebarLogo collapsed={!isExpanded} />
        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => (
            <NavItem key={item.path} item={item} isActive={isNavActive(item.path, location.pathname)}
              collapsed={!isExpanded} onClick={() => handleNavClick(item.path)} />
          ))}
        </nav>
        <div className="p-2 border-t border-border">
          <button onClick={() => { setCollapsed(!collapsed); setHovered(false); }} className="w-full flex items-center justify-center p-2 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-all">
            {!isExpanded ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-h-screen overflow-hidden">
        <TopBar onLogout={logout} />
        <div className="flex-1 overflow-auto"><Outlet /></div>
      </main>
    </div>
  );
}