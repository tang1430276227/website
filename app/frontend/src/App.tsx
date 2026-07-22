import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import AuthCallback from './pages/AuthCallback';
import AuthError from './pages/AuthError';
import DashboardLayout from './components/DashboardLayout';
import Dashboard from './pages/Dashboard';
import ChatPage from './pages/ChatPage';
import AgentsPage from './pages/AgentsPage';
import WorkflowPage from './pages/WorkflowPage';
import McpToolsPage from './pages/McpToolsPage';
import AdminPage from './pages/AdminPage';
import ModelExperiencePage from './pages/ModelExperiencePage';
import GamePage from './pages/GamePage';
import LandingPage from './pages/LandingPage';

const queryClient = new QueryClient();

const AppRoutes = () => (
  <Routes>
    <Route path="/" element={<LandingPage />} />
    <Route path="/auth/callback" element={<AuthCallback />} />
    <Route path="/auth/error" element={<AuthError />} />
    <Route path="/app" element={<DashboardLayout />}>
      <Route index element={<Dashboard />} />
      <Route path="chat" element={<ChatPage />} />
      <Route path="chat/:conversationId" element={<ChatPage />} />
      <Route path="experience" element={<ModelExperiencePage />} />
      <Route path="agents" element={<AgentsPage />} />
      <Route path="workflows" element={<WorkflowPage />} />
      <Route path="mcp-tools" element={<McpToolsPage />} />
      <Route path="games" element={<GamePage />} />
      <Route path="admin" element={<AdminPage />} />
    </Route>
  </Routes>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
export { AppRoutes };