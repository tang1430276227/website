# Project Context

## Project Overview
LLM Gateway Platform - A multi-tenant SaaS platform for forwarding requests to different LLM providers. Features model chat, AI Agent editor with visual workflow, MCP tool extensions, and cluster-ready microservice architecture.

## Key Decisions
| Date | Decision | By | Rationale |
|------|----------|-----|-----------|
| 2026-07-19 | Use Atoms Cloud as backend | Alex | Provides auth, DB, edge functions out of box |
| 2026-07-19 | React + shadcn/ui for frontend | Alex | Template already initialized |
| 2026-07-19 | Monaco Editor for code editing | Alex | Industry standard, rich features |
| 2026-07-19 | React Flow for workflow visualization | Alex | Best React library for node-based editors |
| 2026-07-19 | Microservice pod architecture | Alex | Scalability to millions of users |
| 2026-07-19 | Redis + PgSQL + MQ for infra | Alex | High concurrency state management and task queuing |

## Constraints
- Design Style: Dark theme with gradient accents, modern SaaS dashboard aesthetic
- Color Palette: Slate-900 base, Blue-500/Purple-500 gradients for accents, Emerald for success states
- Typography: Inter for UI, JetBrains Mono for code
- Layout: Sidebar navigation with collapsible panels
- Max 8 code files for MVP implementation
- Cluster architecture documented via Docker Compose + K8s Helm Chart

### 代码编写规范（强制）
1. **禁止长篇if/else** - 使用Map/Object路由模式替代条件分支
2. **单个函数不超过50行** - 超过则拆分为多个小函数
3. **减少try/catch使用** - 在中间件层统一捕获异常，业务代码中仅在特殊情况使用try
4. **代码简洁性** - 保持代码简洁、可读、可维护
5. **命名规范** - 变量和函数命名清晰表达意图