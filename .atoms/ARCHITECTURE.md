# Architecture Design

## System Overview
LLM Gateway Platform is a multi-tenant SaaS platform designed for forwarding requests to different LLM providers. It follows a microservice architecture pattern with clear separation between Gateway, Auth, Chat, Agent, MCP, and Admin services. The platform supports horizontal scaling to millions of users through containerized deployment with Kubernetes.

## Tech Stack
- **Frontend**: React 18 + TypeScript + Vite + shadcn/ui + Tailwind CSS
- **Backend**: Python FastAPI + SQLAlchemy (async) + Atoms Cloud
- **Database**: PostgreSQL 16 (primary store)
- **Cache**: Redis 7 (session, rate limiting, pub/sub)
- **Message Queue**: RabbitMQ 3.13 (async task queue, agent execution)
- **Code Editor**: Monaco Editor (VS Code engine)
- **Workflow Engine**: React Flow (@xyflow/react)
- **Container**: Docker + Kubernetes (Helm Chart)

## Module Design
| Module | Responsibility | Key Files |
|--------|---------------|-----------|
| Gateway | API routing, rate limiting, load balancing | deploy/nginx/, deploy/k8s/ |
| Auth Service | User authentication, session management, OAuth | backend/routers/auth, contexts/AuthContext |
| Chat Service | LLM request forwarding, streaming proxy, conversation management | backend/routers/chat.py, pages/ChatPage.tsx |
| Agent Service | Agent CRUD, code execution, workflow scheduling | backend/routers/agents.py, pages/AgentsPage.tsx |
| MCP Service | MCP tool proxy, server registration, tool discovery | backend/routers/mcp_tools.py, pages/McpToolsPage.tsx |
| Admin Service | API key management, provider config, usage stats | backend/routers/api_keys.py, pages/AdminPage.tsx |
| Workflow Engine | Visual node editor, workflow persistence | pages/WorkflowPage.tsx, backend/routers/workflows.py |
| Frontend Shell | Dashboard layout, routing, auth context | App.tsx, DashboardLayout.tsx |

## Tech Decisions
| Decision | Choice | Rationale |
|----------|--------|-----------|
| Backend Framework | FastAPI (async) | High performance, native async, OpenAPI docs |
| Frontend Framework | React + shadcn/ui | Component library, TypeScript, modern DX |
| Code Editor | Monaco Editor | VS Code engine, rich language support |
| Workflow UI | React Flow (@xyflow/react) | Best React node-based editor library |
| Message Queue | RabbitMQ | Reliable delivery, priority queues, dead letter |
| Cache Layer | Redis | Sub-ms latency, pub/sub, rate limiting |
| Container Orchestration | Kubernetes + Helm | Industry standard, HPA autoscaling |
| Microservice Split | 6 pods | Independent scaling per service type |

## File Tree Plan
```
app/
├── backend/
│   ├── routers/
│   │   ├── chat.py          # Chat proxy API
│   │   ├── agents.py        # Agent CRUD (auto-generated)
│   │   ├── workflows.py     # Workflow CRUD (auto-generated)
│   │   ├── mcp_tools.py     # MCP tools CRUD (auto-generated)
│   │   ├── api_keys.py      # API keys CRUD (auto-generated)
│   │   ├── model_providers.py # Provider config (auto-generated)
│   │   ├── conversations.py  # Conversations CRUD (auto-generated)
│   │   └── messages.py       # Messages CRUD (auto-generated)
│   ├── services/
│   │   └── chat_service.py   # Chat business logic
│   └── models/               # ORM models (auto-generated)
├── frontend/
│   └── src/
│       ├── App.tsx           # Router shell
│       ├── components/
│       │   └── DashboardLayout.tsx  # Sidebar + top bar layout
│       ├── contexts/
│       │   └── AuthContext.tsx      # Auth state management
│       └── pages/
│           ├── LandingPage.tsx      # Public landing page
│           ├── Dashboard.tsx        # Stats + quick actions
│           ├── ChatPage.tsx         # Multi-model chat UI
│           ├── AgentsPage.tsx       # Agent editor + Monaco
│           ├── WorkflowPage.tsx     # React Flow workflow editor
│           ├── McpToolsPage.tsx     # MCP tools management
│           └── AdminPage.tsx        # Admin panel
└── deploy/
    ├── docker-compose.yml    # Full cluster compose
    └── k8s/
        └── helm-chart/       # Kubernetes Helm Chart
            ├── Chart.yaml
            └── values.yaml
```

## Implementation Guide
### Cluster Architecture (6 Pods)
1. **Gateway Pod** - Nginx reverse proxy with rate limiting (3-20 replicas)
2. **Auth Pod** - JWT/OAuth authentication (3-10 replicas)
3. **Chat Pod** - LLM streaming proxy, highest traffic (5-50 replicas)
4. **Agent Pod** - Agent execution engine (3-30 replicas)
5. **MCP Pod** - Tool proxy service (2-15 replicas)
6. **Admin Pod** - Management APIs (2-5 replicas)

### Scaling Strategy
- HPA (Horizontal Pod Autoscaler) on CPU/Memory utilization
- Redis for session caching and rate limiting counters
- RabbitMQ for async agent task queuing with priority
- PostgreSQL connection pooling (PgBouncer recommended for production)
- CDN for frontend static assets