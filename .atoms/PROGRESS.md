# Requirements & Progress

## Requirements Overview
Multi-tenant SaaS LLM forwarding platform with system admin, tenant admin, and user-facing pages. Includes model chat, AI Agent editor with visual workflow, MCP tool management, and cluster-ready microservice architecture.

## User Stories
- As a user, I can chat with multiple LLM models through a unified interface
- As a user, I can create and edit AI Agents with code editor and visual workflow
- As a user, I can register and manage MCP extension tools
- As a tenant admin, I can manage users, API keys, and usage quotas
- As a system admin, I can configure model providers and manage tenants

## Task Breakdown
- [x] Create database tables (model_providers, api_keys, agents, conversations, messages, mcp_tools, workflows)
- [x] Build authentication flow with role-based access
- [x] Build main dashboard page with navigation
- [x] Build model chat interface with multi-model switching and streaming
- [x] Build AI Agent editor page with Monaco code editor
- [x] Build visual workflow editor with React Flow
- [x] Build MCP tools management page
- [x] Build admin panel (user management, API keys, usage stats)
- [x] Create backend custom APIs for chat proxy, agent execution, and admin operations
- [x] Provide Docker Compose + Kubernetes Helm Chart for cluster deployment
- [x] Multi-tenant isolation (tenants + tenant_members tables, tenant management API)
- [x] Multi-provider LLM forwarding (Map-dispatched adapters for OpenAI/Anthropic/Google/DeepSeek/Zhipu/Qwen/Custom)
- [x] Agent code execution service (prompt_agent + code_agent strategies, execution tracking)
- [x] Billing system (token-based usage tracking, model pricing map, quota enforcement)
- [x] MCP protocol communication (server discovery, tool invocation, connection management)

## Progress Log
- Started project initialization with Atoms Cloud backend
- Created 7 database tables: model_providers, api_keys, agents, conversations, messages, mcp_tools, workflows
- Built chat proxy backend API with streaming support
- Built full frontend: Landing page, Dashboard, Chat, Agents, Workflows, MCP Tools, Admin
- Created Docker Compose configuration with all microservice pods
- Created Kubernetes Helm Chart with HPA autoscaling for cluster deployment
- All lint and build checks passed
- Refactored all code per coding standards: no long if/else (use Map routing), functions <50 lines, removed try/catch from business logic, extracted sub-components
- Refactored all 7 backend entity services: extracted BaseService with COERCION_MAP dispatch pattern, eliminated duplicated 230-line files into 4-line subclasses, removed try/catch from read operations
- Implemented 5 core features: multi-tenant isolation, multi-provider LLM forwarding, agent execution, billing/quota, MCP protocol
- Created 5 new DB tables: tenants, tenant_members, usage_records, agent_executions, mcp_connections
- Created 4 new API routers: llm_gateway, agent_executor, mcp_protocol, tenant_management
- All code follows Map routing pattern, functions <50 lines, no unnecessary try/catch
- Wired all frontend page buttons to backend APIs: AgentsPage test run, McpToolsPage ping/discover, AdminPage real usage stats, Dashboard live counts
- Fixed CSS rendering and integrated platform built-in AI models (claude-opus-4.6, gpt-5.4, deepseek-v4-pro, gemini-3.1-pro-preview, gpt-image-2, gemini-3-pro-image-preview) via client.ai SDK
- ChatPage now uses client.ai.gentxt for text models (streaming) and client.ai.genimg for image models directly
- Fixed login button: replaced custom authApi (axios to non-existent endpoint) with web-sdk client.auth.toLogin() for proper OIDC redirect
- AuthContext now uses client.auth.me() for auth checking and client.auth.toLogin()/logout() for auth actions
- Optimized AdminPage data loading: parallel Promise.all for all 3 API calls, skeleton placeholders during load, cached data avoids redundant re-fetches on tab switch
- AgentsPage delete uses optimistic UI with rollback on failure
- Optimized Dashboard: merged all 5 API calls into single Promise.all, added Skeleton placeholders for stat cards
- Optimized ChatPage: added conversation list skeleton, typing indicator (bounce dots) before stream starts, optimistic delete for conversations, immediate user message display
- Added "模型体验" page with model cards (name, description, highlights), click card to enter drawing mode
- Sidebar auto-collapses on ChatPage and AgentsPage routes
- Sidebar has toggle button for manual collapse/expand
- Redesigned AgentsPage: card grid with model type, description, highlights; click card enters detail/edit view with code editor, config, test tabs
- Redesigned WorkflowPage: card grid with node count, description, highlights; click card enters visual flow editor
- Redesigned McpToolsPage: enhanced card layout for both built-in and custom tools with gradients, highlights, consistent style
- Rebuilt ModelExperiencePage with 4-petal creative layout: 心灵对话(文生文), 创作空间(文生图/图生图), 盗梦空间(文生视频/图生视频), 心灵声处(文生音频/语音识别)
- Added all models: gpt-5.4, claude-opus-4.6, deepseek-v4-pro, gpt-image-2, gemini-3-pro-image-preview, gemini-3.1-flash-image-preview, seedance-2.0, wan2.6-t2v, wan2.6-i2v, veo-3.1-generate-001, seedance-2.0-fast, seedance-1-5-pro, eleven_v3, qwen3-tts-flash, gemini-2.5-pro-preview-tts, scribe_v2
- Supports image upload for img2img and img2video with base64 conversion
- Lazy loading for generated images
- Generation records saved to database for history
- Moved "模型对话" below "模型体验" in sidebar navigation
- Inserted 10 preset Agents: 代码助手、翻译助手、写作助手、数据分析师、客服机器人、法律顾问、健康顾问、教育导师、创意策划、项目经理
- Inserted 10 preset MCP tools: 网页搜索、文件管理、数据库查询、API调试、代码执行、邮件发送、日程管理、知识库检索、图表生成、自动化脚本
- Added staggered slide-in animation (right to left, 24px, 100ms delay per card) to ModelExperiencePage and AgentsPage cards
- Added same slide-in animation to McpToolsPage (both built-in and custom tool cards)
- Added same slide-in animation to WorkflowPage cards
- Added top-to-bottom slide-in animation to ChatPage conversation history list (80ms staggered delay)
- Sidebar auto-hides on nav item click, expands on mouse hover (auto-hide dock behavior)
- Renamed "工作流" to "工作流编排" in sidebar and page title
- Rebuilt WorkflowPage with full functionality: custom nodes with Agent/MCP tool selection from database, run button with input dialog, real-time node execution status visualization (waiting/running/completed/failed with colors and animations), topological sort execution order, actual API calls to agent_executor and mcp_protocol endpoints
- ModelExperiencePage animation changed: removed rotation, replaced with bloom-from-center animation (scale 0.5→1 with spring easing, staggered 150ms per petal)
- Inserted preset "小红书推文生成" workflow with 6 nodes: 关键词输入、图片输入(可选)、搜索小红书文案(MCP网页搜索)、图片描述分析(创意策划Agent)、生成小红书文案(写作助手Agent)、发送文案(邮件发送工具)
- Removed authentication checks for faster loading - users go directly to Dashboard without auth delays
- Rebuilt GamePage with classic mini-games using pure HTML5/JS/Canvas (no external iframe): Tetris, Snake, Breakout, Space Invaders, Pac-Man - all playable directly in-browser
- ChatPage streaming output with blinking cursor: assistant messages stream token-by-token, a blinking `|` cursor appears at the end during streaming to simulate typing, cursor disappears when output completes