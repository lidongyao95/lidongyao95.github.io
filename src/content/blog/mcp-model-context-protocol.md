---
title: 'MCP：给 LLM 装上 USB-C 接口'
date: 2026-06-24
excerpt: '拆解 Model Context Protocol 的设计理念、通信架构与工程实践，理解 AI 工具集成的下一代标准。'
---

## 前言

你有没有想过一个问题：为什么 ChatGPT 能搜索网页、读文件、画图，而你在本地跑的开源 LLM 什么都做不了？

不是因为模型本身不行，而是因为缺少一个关键的组件——**和外部世界对话的通道**。模型只能生成文本，不能真的去查数据库、调 API、读文件。要让它「做事」，需要在模型外面搭一套工具调用系统。

过去几年，每个团队都在自己造这套系统：自己定义工具格式、自己写调用逻辑、自己处理错误。结果是大量重复劳动，而且互相不兼容。

2024 年 11 月，Anthropic 开源了 **Model Context Protocol（MCP）**，试图解决这个问题。它的设计思路可以浓缩成一句话：**给 LLM 一个标准的 USB-C 接口。**

这篇文章会拆解 MCP 到底是什么、怎么工作、以及它为什么重要。

## 1. 问题背景：N×M 的工具集成困局

### 1.1 每个 AI 应用都在重复造轮子

想象这个场景：你想让你的 AI 助手能读取 Slack 消息、查询 GitHub PR、搜索本地文件。你需要做什么？

为每个数据源写一套集成代码：

```text
Slack API → 自定义适配器 → 你的 AI 应用
GitHub API → 自定义适配器 → 你的 AI 应用
本地文件系统 → 自定义适配器 → 你的 AI 应用
```

如果你有 3 个 AI 应用和 5 个数据源，你需要写 15 个适配器。这就是经典的 **N×M 问题**。

### 1.2 为什么这么痛苦

工具集成的痛点不只是代码量：

**格式不统一。** Slack API 返回 JSON，GitHub 返回 JSON 但结构完全不同，文件系统返回文本流。每个工具都需要单独的解析逻辑。

**认证不统一。** OAuth、API Key、Session Token、Basic Auth——每种工具的认证方式都不一样。

**错误处理不统一。** 有的工具返回 HTTP 状态码，有的返回自定义错误码，有的直接崩溃。

**没有发现机制。** LLM 怎么知道有哪些工具可用？每个团队都在自己的 prompt 里硬编码工具列表，一旦工具变化就得改代码。

这就像 USB 标准出现之前的世界：每个设备都有自己的线缆、接口和驱动。你出门要带一堆线，到了朋友家一个都接不上。

## 2. MCP 的核心设计

### 2.1 一句话理解 MCP

MCP 把 AI 工具集成从一个 N×M 问题变成了 N+M 问题：

```text
                    MCP 之前 (N×M)                MCP 之后 (N+M)
                ┌──────────────────┐        ┌──────────────────┐
                │                  │        │                  │
   ┌────┐  ────▶│  Slack 适配器 ×3 │        │  Slack Server ×1 │──┐
   │App1│       │  GitHub 适配器 ×3│        │  GitHub Server ×1│  │
   ├────┤       │  FS 适配器 ×3   │   ──▶  ├──────────────────┤  ├──▶ App1/2/3
   │App2│  ────▶│  ...            │        │    MCP 协议层     │  │
   ├────┤       │                  │        ├──────────────────┤  │
   │App3│  ────▶│  (15 个适配器)   │        │  Slack Client ×1 │──┘
   └────┘       │                  │        │  GitHub Client ×1│
                └──────────────────┘        │  FS Client ×1    │
                                            └──────────────────┘
```

**关键洞察：** 工具提供方只需要实现一次 MCP Server，AI 应用方只需要实现一次 MCP Client。双方都遵循同一个协议。

下面这张图把这种变化画得更直观：左边是每个应用都要单独接每个工具的「蜘蛛网」，右边是 MCP 把连接关系收束成统一协议层后的结构。

![MCP 将工具集成从 N×M 问题简化为 N+M 问题](/images/mcp-vs-traditional.png)

### 2.2 架构角色

MCP 的架构中有三个角色：

**Host（宿主）。** 运行 LLM 的应用程序，比如 Claude Desktop、Cursor、你的自定义 AI 应用。Host 负责发起与 MCP Server 的连接。

**Client（客户端）。** Host 内部的组件，每个 Client 维护一个与特定 MCP Server 的 1:1 连接。

**Server（服务器）。** 提供工具、资源和提示模板的外部服务。比如一个 Slack MCP Server、一个 GitHub MCP Server。

```text
┌─────────────────────────────────┐
│           Host (宿主)            │
│  ┌───────────────────────────┐  │
│  │          LLM              │  │
│  └─────────────┬─────────────┘  │
│                │                │
│  ┌─────┐ ┌─────┐ ┌─────┐       │
│  │Cli A│ │Cli B│ │Cli C│       │
│  └──┬──┘ └──┬──┘ └──┬──┘       │
└─────┼───────┼───────┼──────────┘
      │       │       │
  ┌───▼──┐┌───▼──┐┌───▼──┐
  │Server││Server││Server│
  │Slack ││GitHub││ FS   │
  └──────┘└──────┘└──────┘
```

### 2.3 三个核心能力

MCP Server 可以向 Client 暴露三种能力：

**Tools（工具）。** 模型可以调用的操作。比如「发送 Slack 消息」「创建 GitHub Issue」「读取文件」。工具是模型主动发起的。

**Resources（资源）。** 模型可以读取的数据。比如文件内容、数据库记录、API 返回值。资源是被动提供的，由 Host 决定什么时候给模型看什么资源。

**Prompts（提示模板）。** 预定义的提示词模板，用于常见任务。比如「分析这段代码」「总结这个 PR」。用户可以调用这些模板，也可以让模型参考。

这三个能力覆盖了 AI 工具集成的绝大多数场景。

## 3. 通信协议

### 3.1 基于 JSON-RPC 2.0

MCP 的通信层基于 **JSON-RPC 2.0**，一个轻量级的远程过程调用协议。所有消息都是 JSON 格式，包含三种类型：

**Request（请求）。** Client 发给 Server，要求执行某个操作，期望得到响应。

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "search_github",
    "arguments": {"query": "MCP protocol", "language": "python"}
  }
}
```

**Response（响应）。** Server 对 Request 的回复，包含结果或错误。

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [{"type": "text", "text": "找到 42 个仓库..."}]
  }
}
```

**Notification（通知）。** 单向消息，不需要响应。比如「进度更新」「日志输出」。

选择 JSON-RPC 2.0 是一个务实的决定——协议成熟、库丰富、调试友好，比 gRPC 或自定义协议更容易上手。

### 3.2 两种传输方式

MCP 支持两种传输方式：

**stdio。** Server 作为一个本地进程运行，通过标准输入/输出与 Client 通信。适合本地工具（文件系统、本地数据库）。

```text
Host ──stdin──▶ MCP Server ──stdout──▶ Host
```

**HTTP + SSE（Server-Sent Events）。** Server 作为一个 HTTP 服务运行，通过 SSE 推送事件。适合远程工具（云 API、第三方服务）。

```text
Host ──HTTP POST──▶ MCP Server ──SSE──▶ Host
```

stdio 模式更简单，延迟更低，适合本地场景。HTTP+SSE 模式更灵活，支持多客户端连接，适合远程场景。

### 3.3 生命周期

一个 MCP 连接的生命周期分为三个阶段：

**初始化（Initialization）。** Client 和 Server 握手，交换能力信息。Client 告诉 Server 自己支持什么特性，Server 告诉 Client 自己提供什么工具。

**运行（Operation）。** 正常的消息交换阶段。Client 发请求，Server 处理并回复。

**关闭（Shutdown）。** 连接结束，清理资源。

```text
Client                          Server
  │                               │
  │──── initialize ──────────────▶│
  │◀─── initialize response ─────│
  │──── initialized notification ▶│
  │                               │
  │──── tools/list ──────────────▶│
  │◀─── tools list response ─────│
  │                               │
  │──── tools/call ──────────────▶│
  │◀─── tool result ─────────────│
  │                               │
  │──── shutdown ────────────────▶│
  │                               │
```

## 4. 工具定义与调用

### 4.1 工具的 JSON Schema 定义

MCP 中的工具用 JSON Schema 来描述参数结构：

```json
{
  "name": "query_database",
  "description": "对数据库执行 SQL 查询，返回结果集。只支持 SELECT 语句。",
  "inputSchema": {
    "type": "object",
    "properties": {
      "sql": {
        "type": "string",
        "description": "要执行的 SQL 查询语句"
      },
      "limit": {
        "type": "integer",
        "description": "最大返回行数",
        "default": 100
      }
    },
    "required": ["sql"]
  }
}
```

这个定义对 LLM 来说就是工具的「说明书」。`description` 字段尤其重要——模型通过阅读它来判断这个工具能不能解决当前问题。写得不好，模型就不会用或者用错。

### 4.2 工具调用的完整流程

一次工具调用的完整链路：

```text
用户: "帮我查一下项目里有多少个 open issue"
  │
  ▼
LLM 分析意图，决定调用工具
  │
  ├── 生成 tool call:
  │   {
  │     "name": "list_github_issues",
  │     "arguments": {"state": "open", "repo": "my-project"}
  │   }
  │
  ▼
MCP Client 收到 tool call
  │
  ├── 查找对应的 MCP Server
  ├── 通过 JSON-RPC 发送请求
  │
  ▼
MCP Server 处理请求
  │
  ├── 调用 GitHub API
  ├── 格式化返回结果
  │
  ▼
MCP Client 收到结果，返回给 LLM
  │
  ▼
LLM 根据结果生成自然语言回答:
  "你的项目 my-project 目前有 23 个 open issue，
   其中 5 个标记为 bug，3 个标记为 enhancement。"
```

### 4.3 错误处理

MCP 对错误有统一的定义：

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32602,
    "message": "Invalid params: 'sql' must be a SELECT statement"
  }
}
```

标准化的错误码让 LLM 能理解失败原因并采取补救措施。这比返回一个原始异常堆栈有用得多——模型读不懂 Python traceback，但能理解「参数不合法：sql 必须是 SELECT 语句」这样的结构化信息。

## 5. 与现有方案的对比

### 5.1 MCP vs Function Calling

OpenAI 的 Function Calling 是目前最流行的工具集成方案。MCP 和它有什么关系？

| 维度 | Function Calling | MCP |
|------|-----------------|-----|
| **范围** | 模型 API 层面的能力 | 完整的集成协议 |
| **工具定义** | 在 prompt 中定义 | Server 动态暴露 |
| **工具执行** | 由调用方自行实现 | 由 MCP Server 负责 |
| **发现机制** | 无（硬编码） | 有（tools/list） |
| **标准化** | 各家不同 | 统一标准 |
| **生态** | 与特定模型绑定 | 跨模型通用 |

简单说，Function Calling 是「模型知道怎么请求工具」，MCP 是「工具知道怎么被发现、被调用、被组合」。两者不冲突——MCP 可以建立在 Function Calling 之上，也可以建立在其他工具调用机制之上。

### 5.2 MCP vs LangChain Tools

LangChain 的 Tools 生态也是一个流行的工具集成方案。对比：

**LangChain Tools** 是一个 Python 框架内的工具注册系统。工具和框架耦合紧密，换一个框架就得重写。

**MCP** 是一个跨语言、跨框架的协议。一个 MCP Server 可以用 Python 写，另一个用 TypeScript，Client 不需要关心。

```text
LangChain:  Python App → LangChain Framework → LangChain Tools
MCP:        Any App → MCP Client → Any MCP Server (any language)
```

LangChain 可以成为 MCP 生态的一部分——在 LangChain 应用中使用 MCP Client 来连接 MCP Server，而不是只依赖 LangChain 内置的 Tools。

## 6. 工程实践

### 6.1 快速上手：写一个 MCP Server

用 TypeScript 写一个简单的 MCP Server，提供「查询天气」工具：

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({
  name: "weather-server",
  version: "1.0.0",
});

server.tool(
  "get_weather",
  "获取指定城市的当前天气信息",
  {
    city: z.string().describe("城市名称，如 Beijing"),
  },
  async ({ city }) => {
    // 调用天气 API
    const response = await fetch(
      `https://api.weather.com/v1/current?city=${city}&key=${API_KEY}`
    );
    const data = await response.json();

    return {
      content: [
        {
          type: "text",
          text: `${city} 当前天气：${data.description}，
                 温度 ${data.temp}°C，湿度 ${data.humidity}%`,
        },
      ],
    };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
```

然后在 MCP 配置文件中注册这个 Server：

```json
{
  "mcpServers": {
    "weather": {
      "command": "node",
      "args": ["./weather-server.js"]
    }
  }
}
```

启动支持 MCP 的应用（如 Claude Desktop），它会自动发现并加载这个工具。

### 6.2 安全性考量

MCP Server 拥有真实世界的操作能力，安全是头等大事。

**最小权限。** 每个 Server 只暴露必要的工具。文件系统 Server 应该限制在特定目录，数据库 Server 应该限制为只读（除非明确需要写入）。

**输入验证。** 所有工具参数都需要严格验证。上面的示例中，`zod` 库用于验证 `city` 参数是字符串。更复杂的场景需要防止 SQL 注入、路径穿越等攻击。

**认证与授权。** 远程 MCP Server（HTTP+SSE 模式）需要实现认证。可以用 API Key、OAuth 或者 JWT，取决于场景。

**审计日志。** 记录每一次工具调用，包括谁调用了什么、参数是什么、结果如何。这在排查问题时价值巨大。

**沙箱执行。** 对于代码执行类工具，使用 Docker 容器或 microVM 隔离执行环境。即使模型生成了恶意代码，也只能在沙箱内生效。

### 6.3 性能优化

**连接复用。** stdio 模式下，每个 Server 是独立进程。如果频繁启动和关闭，开销不小。考虑使用连接池或长连接。

**结果缓存。** 对于不经常变化的数据（如配置信息），在 Client 侧缓存，减少不必要的 Server 调用。

**并行调用。** 当一个任务需要调用多个独立工具时，并行执行而不是串行。MCP 协议本身支持并行请求。

**流式响应。** 对于大结果集（如长文件内容），使用流式传输而不是等待全部生成完毕。

## 7. MCP 的生态现状

### 7.1 已有生态

截至 2025 年中，MCP 生态已经有了相当的规模：

**官方 Server。** Anthropic 提供了 GitHub、Slack、Google Drive、PostgreSQL 等官方 Server 实现。

**社区 Server。** 开源社区贡献了大量 Server，覆盖文件系统、数据库、搜索引擎、代码仓库、项目管理工具等。

**Host 支持。** Claude Desktop 是第一个支持 MCP 的应用，随后 Cursor、Windsurf、Zed 等 AI 编辑器也加入了支持。2025 年 3 月，**OpenAI 正式宣布在 ChatGPT、API 和 Agents SDK 中原生支持 MCP**，这标志着 MCP 从 Anthropic 主导的项目正式成为行业事实标准。Google、Microsoft 等公司也陆续跟进。

### 7.2 典型应用场景

**AI 编程助手。** 通过 MCP 让编辑器直接访问代码仓库、CI/CD 系统、问题追踪系统。模型可以读取 PR diff、查看测试结果、创建修复补丁。

**企业知识管理。** 通过 MCP 连接内部知识库、文档系统、项目管理工具。AI 助手可以回答「上周的会议纪要里关于 X 项目说了什么」这类问题。

**数据分析。** 通过 MCP 连接数据库和数据仓库。AI 可以直接查询数据、生成图表、导出报告。

**DevOps 自动化。** 通过 MCP 连接监控系统、日志系统、部署工具。AI 可以检查服务状态、分析日志、执行部署操作。

## 8. MCP 的挑战与未来

### 8.1 当前挑战

**生态碎片化风险。** MCP 虽然开源了，但不是所有人都愿意采用同一个标准。如果 Google 和 OpenAI 各自推一套协议，又回到了 N×M 问题。

**安全模型不够成熟。** MCP 的安全机制还在早期。Maloyan 和 Namiot（2026）在安全分析中发现了 MCP 的三个结构性漏洞：未验证的权限声明、未认证的采样请求（可能被注入攻击利用）、以及多 Server 场景下的信任假设问题。他们提出的协议更新显著降低了攻击成功率。生产环境需要更完善的认证、授权和审计方案。

**工具描述质量堪忧。** Hasan 等人（2026）首次系统研究了 MCP 工具描述的质量，发现几乎所有工具描述都存在缺陷——超过一半未能解释其核心功能。增强描述可以提高任务完成率，但也增加了 token 成本，揭示了描述质量与成本之间的权衡。

**调试困难。** 当一个 MCP 工具调用出错时，需要追踪从 Client 到 Server 再到外部 API 的整条链路。目前的工具链对调试支持还不够好。

**性能开销。** 每次工具调用都经过 JSON 序列化/反序列化、进程间通信、参数校验。对于高频调用场景，这些开销不可忽视。

### 8.2 未来方向

**标准化推进。** MCP 正在从 Anthropic 主导的开源项目，向行业标准演进。2025 年初，OpenAI、Microsoft 等公司也开始参与 MCP 的讨论。

**更丰富的传输方式。** 除了 stdio 和 HTTP+SSE，未来可能支持 WebSocket（双向实时通信）、gRPC（高性能 RPC）等传输方式。

**工具编排。** 不只是单个工具调用，而是多个工具的自动组合。比如「查数据库 → 生成图表 → 发送邮件」这种工作流。

**安全增强。** 更完善的认证授权框架、细粒度权限控制、端到端加密。

## 结语

MCP 解决的不是一个技术问题，而是一个生态问题。

在 MCP 之前，AI 工具集成是一个个孤立的烟囱。每个团队都在重复造轮子，每个工具都有自己的一套集成方式。MCP 的价值在于：它第一次让「AI 连接外部世界」有了一个真正的标准。

就像 USB-C 统一了充电线，HTTP 统一了网页协议，MCP 正在试图统一 AI 工具的接入层。这不是一夜之间能完成的事情——生态的建立需要时间，标准的完善需要迭代，采用率的提升需要行业共识。

但方向是对的。当足够多的工具提供商和 AI 应用都采用 MCP 时，我们终于可以把精力从「怎么连接」转移到「连接之后做什么」——那才是 AI 真正改变工作方式的地方。

## 参考文献

Anthropic. (2024). *Introducing the Model Context Protocol*. https://www.anthropic.com/news/model-context-protocol

Model Context Protocol Specification. https://modelcontextprotocol.io/specification

Anthropic. (2024). *Model Context Protocol SDK*. https://github.com/modelcontextprotocol

OpenAI. (2025). *Introducing MCP Support in ChatGPT, API, and Agents SDK*. https://openai.com

Maloyan, N., Namiot, D. (2026). *Breaking the Protocol: Security Analysis of the Model Context Protocol Specification and Prompt Injection Vulnerabilities in Tool-Integrated LLM Agents*. https://arxiv.org/abs/2601.17549

Hasan, M., Li, H., Rajbahadur, G., Adams, B., Hassan, A. (2026). *Model Context Protocol (MCP) Tool Descriptions Are Smelly! Towards Improving AI Agent Efficiency with Augmented MCP Tool Descriptions*. https://arxiv.org/abs/2602.14878

Ahmadi, A., Sharif, S., Banad, Y. (2025). *MCP Bridge: A Lightweight, LLM-Agnostic RESTful Proxy for Model Context Protocol Servers*. https://arxiv.org/abs/2504.08999

Jia, H., Liao, J., Zhang, X., et al. (2025). *OSWorld-MCP: Benchmarking MCP Tool Invocation In Computer-Use Agents*. https://arxiv.org/abs/2510.24563
