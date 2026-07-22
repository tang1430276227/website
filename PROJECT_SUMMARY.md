# LLM Gateway Platform - 项目总结

## 📋 项目定位

**LLM Gateway Platform** 是一个多租户 SaaS 级大模型网关平台，提供统一的 LLM 请求转发、AI Agent 编排、MCP 工具扩展和集群化微服务部署能力。平台面向企业和开发者，帮助他们快速接入多种大模型服务，构建智能应用工作流。

---

## 🚀 核心功能模块

### 1. 模型体验中心

四瓣花创意布局，覆盖主流 AI 能力：

- **心灵对话（文生文）** - 支持 GPT-5.4、Claude Opus 4.6、DeepSeek V4 Pro 等顶级文本模型
- **创作空间（文生图/图生图）** - 支持 GPT Image 2、Gemini 3 Pro Image 等图像生成模型
- **盗梦空间（文生视频/图生视频）** - 支持 Seedance 2.0、Wan 2.6、Veo 3.1 等视频生成模型
- **心灵声处（文生音频/语音识别）** - 支持 Eleven V3、Qwen3 TTS、Scribe V2 等音频模型

### 2. 模型对话

- 多模型实时切换对话
- 流式输出 + 打字机光标效果
- 对话历史管理与持久化
- 支持 Markdown 渲染

### 3. AI Agent 编辑器

- 10 个预置 Agent（代码助手、翻译助手、写作助手、数据分析师等）
- Monaco 代码编辑器（VS Code 内核）
- Agent 配置面板（模型选择、参数调优）
- 一键测试运行

### 4. 工作流编排

- React Flow 可视化节点编辑器
- 支持 Agent 节点 + MCP 工具节点
- 拓扑排序自动执行
- 实时节点状态可视化（等待/运行/完成/失败）
- 预置「小红书推文生成」工作流模板

### 5. MCP 工具管理

- 10 个内置工具（网页搜索、文件管理、数据库查询、API 调试等）
- 自定义工具注册
- 工具发现与连接管理
- 一键 Ping 测试与能力发现

### 6. 游戏时间

- 5 款经典小游戏（纯 HTML5/Canvas 实现）
- 俄罗斯方块、贪吃蛇、打砖块、太空入侵者、吃豆人
- 无需外部依赖，即开即玩

### 7. 管理后台

- 用户管理与角色分配
- API Key 管理
- 用量统计与计费
- 模型提供商配置
- 多租户隔离管理

### 8. 集群部署

- Docker Compose 全栈编排（6 个微服务 Pod）
- Kubernetes Helm Chart（支持 HPA 自动扩缩容）
- 网关层负载均衡与限流
- Redis 缓存 + RabbitMQ 异步队列

---

## 🎯 适用场景

| 场景 | 说明 |
|------|------|
| **企业 AI 中台** | 统一管理多个 LLM 提供商，为内部团队提供标准化 AI 服务接口 |
| **AI 应用开发平台** | 开发者通过可视化工作流快速搭建 AI 应用，无需深入了解底层模型 |
| **智能客服系统** | 利用 Agent + MCP 工具组合，构建自动化客服和知识问答系统 |
| **内容创作工作台** | 文案生成、图片创作、视频制作一站式完成，适合营销团队 |
| **多租户 SaaS 服务** | 为不同客户提供隔离的 AI 服务，支持独立计费和配额管理 |
| **教育培训平台** | AI 导师 Agent 辅助教学，支持多模态交互 |
| **研发效能工具** | 代码助手、数据分析、自动化脚本等提升开发效率 |
| **创意设计工作室** | 文生图、图生视频等多模态能力支持创意产出 |

---

## 💡 技术亮点

- **多提供商适配** - Map 路由模式分发请求至 OpenAI / Anthropic / Google / DeepSeek / 智谱 / 通义等
- **流式响应** - 全链路 SSE 流式输出，打字机效果实时反馈
- **微服务架构** - 6 Pod 独立扩缩容，支持百万级用户并发
- **可视化编排** - React Flow 拖拽式工作流，降低 AI 应用构建门槛
- **代码规范** - Map 路由替代 if/else、函数不超过 50 行、中间件统一异常处理
- **现代前端** - React 18 + TypeScript + shadcn/ui + Tailwind CSS，暗色主题渐变设计
- **零依赖游戏** - 纯 HTML5 Canvas 实现经典游戏，无外部 iframe

---

## 🛠 技术栈

| 层级 | 技术选型 |
|------|----------|
| 前端 | React 18 + TypeScript + Vite + shadcn/ui + Tailwind CSS |
| 后端 | Python FastAPI + SQLAlchemy (async) + Atoms Cloud |
| 数据库 | PostgreSQL 16 |
| 缓存 | Redis 7 |
| 消息队列 | RabbitMQ 3.13 |
| 代码编辑 | Monaco Editor |
| 工作流 | React Flow (@xyflow/react) |
| 部署 | Docker + Kubernetes (Helm Chart) |

---

## 📁 项目结构

```
app/
├── backend/          # 后端服务
│   ├── routers/      # API 路由（chat、agents、workflows、mcp_tools 等）
│   ├── services/     # 业务逻辑层
│   └── models/       # ORM 模型
├── frontend/         # 前端应用
│   └── src/
│       ├── pages/    # 页面组件
│       ├── components/ # 通用组件
│       └── contexts/ # 状态管理
└── deploy/           # 部署配置
    ├── docker-compose.yml
    └── k8s/helm-chart/
```

---

> 🌟 本平台致力于让 AI 能力触手可及，通过统一网关、可视化编排和企业级部署方案，帮助团队快速构建和交付智能应用。