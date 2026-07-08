# AGENTS.md — lidongyao95.github.io 项目约定

本文件是所有 Agent 在本仓库工作时的权威参考。遵循其中的约定，不要偏离。

## 环境

- 框架：Astro 6 + React 19 + Tailwind 3 + MDX
- 数学渲染：remark-math + rehype-katex
- npm：所有 `npm install` / `npm ci` 必须加 `--legacy-peer-deps`（@astrojs/tailwind@6 与 Astro 6 有 peer conflict）
- 部署：GitHub Actions artifact 部署（outDir 是 `dist`），deploy.yml 使用 Node 22
- 构建验证：`npm run build --legacy-peer-deps`

## 博客写作标准

以下规范适用于 `src/content/blog/` 下所有博客文章。**任何 Agent 写新博客时必须遵循。**

### 文件规范

- 目录：`src/content/blog/`
- 格式：`.md`（标准）或 `.mdx`（需要自定义 React/Astro 组件时）
- 文件名：英文 kebab-case，作为 URL slug，例如 `feature-vectors-in-llm.md`

### Frontmatter

```yaml
---
title: '中文标题，常用「主题：副标题」结构'
date: 2026-06-19          # 当天日期，ISO 格式
excerpt: '一句话概括文章范围和切入角度。'
group: 'training'         # 可选，知识图谱社区归属覆盖；新主题树或自动归属不清晰时必须写
---
```

标准字段只有 title、date、excerpt 三个。`group` 字段仅在需要指定知识图谱社区时添加，可选值为现有簇名（如 `sequence`、`training`、`rag`、`agent`、`graphics`）。不要添加 tags、category 等。

### 结构模板

```text
## 前言              ← 场景代入，交代动机和读者会获得什么
## 1. 第一节标题       ← 编号主节，逻辑递进
### 1.1 子节标题
### 1.2 子节标题
## 2. 第二节标题
...
## N. 实践/总结性章节   ← 靠近末尾偏实用或综合
## 结语               ← 反思性收尾，不是机械总结
## 参考文献            ← 可选，列出论文引用
```

要点：
- 必须以 `## 前言` 开头，以 `## 结语` 收尾
- 主节用 `## N.` 编号，子节用 `### N.M` 编号
- 参考文献中每条包含：作者、**加粗标题**、venue、年份、arxiv 链接

### 写作风格

**语气：对话式，不是教科书。** 想象你在和一个聪明的同行喝咖啡聊天，不是在写教材。

- 先给直觉，再给形式化定义
- 大量使用类比和比喻来建立直觉（例如交响乐类比、考试复习类比）
- 场景代入式开头——先描述一个具体场景或问题，再展开
- 用「你」「我们」来和读者对话
- 避免堆叠编号列表替代论述，列表只在对比和枚举时使用

**语言：中文为主，技术术语保留英文原文。**

- "Transformer"、"Self-Attention"、"fine-tuning" 不翻译
- 首次出现的概念可加括号标注英文：功能向量（feature vector）
- 中文标点为主，技术公式和代码内用英文标点

### 格式化元素

| 元素 | 用法 | 示例 |
|------|------|------|
| LaTeX 公式 | 块公式 `$$...$$`，行内 `$...$` | `$h \in \mathbb{R}^d$` |
| ASCII 图 | 用 ` ```text ` 包裹，描述数据流或架构 | 见各文章中的流程图 |
| 对比表格 | Markdown 表格，用于方法/概念对比 | 见功能向量文章 §3 |
| 代码块 | 带语言标注，`python`/`text` 等 | 实践代码保持可运行 |
| 论文引用 | blockquote 格式 | 见下方格式 |
| 关键术语 | 首次出现时 **加粗** | **叠加假说（Superposition Hypothesis）** |

论文引用格式：

```markdown
> 📄 **论文标题**
> 作者列表. Venue 年份.
> 一句话核心贡献说明。
```

### 内容深度

- 目标读者：AI/ML 研究者，熟悉深度学习基本概念
- 篇幅：200–500 行，深度长文
- 概念 → 方法 → 实践三段式全覆盖
- 包含可运行的代码片段（不要求完整项目，但要片段可执行）
- 引用关键论文，标注 venue 和年份

### 交叉引用与知识图谱

博客列表页有一个知识图谱视图。**图谱不从正文中的 `[文字](/blog/slug)` 链接推断结构关系**；正文链接只是文章内容的一部分，不能用于图谱相关性计算。

知识图谱由 `src/utils/buildGraphData.ts` 构建：

- 构建时会自动扫描 `src/content/blog/` 下所有 `.md/.mdx`，所以新博客会自动出现在右侧列表，并至少生成一个 fallback 图谱节点。
- `TOPICS` 定义“一个节点对应一篇或多篇博客”的主题节点、短标签和说明。
- `STRUCTURAL_LINKS` 定义节点之间的结构边。
- 未被 `TOPICS` 覆盖的新博客会自动生成单篇节点，节点短标签来自标题冒号前的主题，说明来自 `excerpt`。
- `group` 决定社区颜色和树归属；新主题树或自动归属不清晰时必须在 frontmatter 写 `group`。

**写新博客时的流程：**

1. **扫描已有文章与图谱配置**：列出 `src/content/blog/` 下所有文件的 slug/title，并查看 `src/utils/buildGraphData.ts` 的 `TOPICS`、`STRUCTURAL_LINKS`、`GROUP_LABELS`
2. **评估图谱归属**：判断新文章是已有主题节点的一部分、已有社区中的单篇节点，还是全新主题树
3. **维护 frontmatter `group`**：如果是全新主题树或容易被误解的跨领域文章，必须写 `group`，例如 `graphics`
4. **维护 `TOPICS`**：如果新文章应并入一个已有节点，或与另一篇文章组成多篇主题节点，更新对应 `articleIds`；否则允许 fallback 单篇节点自动生成
5. **维护 `STRUCTURAL_LINKS`**：只有当两个主题确实存在知识结构关系时才添加边；不要因为正文互相引用就添加结构边
6. **维护正文交叉引用**：只在内容叙事需要时添加 `[文章标题](/blog/slug)` 链接，不要为了影响图谱而添加链接

**现有主题簇（随文章增删动态变化）：**

| 簇 | 代表文章 | 核心关键词 |
|---|---------|-----------|
| 序列建模 | rnn-lstm-gru, rnn-to-linear-attention, mamba-ssm, transformer-architecture | RNN, Attention, SSM, Linear Attention |
| 训练与对齐 | pretraining-and-finetuning, pretrain-sft-rlhf, generalization-and-interpretability, feature-vectors-in-llm | 预训练, 微调, SFT, RLHF, 对齐 |
| RAG | rag-basics, rag-engineering | 检索增强, 向量检索 |
| Agent 工程 | agent-harness-part1/2, ai-agent-skills, mcp-model-context-protocol, loop-engineering, coding-is-solved | Agent, Skill, MCP, Harness, Loop |
| 计算机图形学 | linear-camera-model-calibration, simple-stereo-vision | Camera Model, Projection, Calibration, Stereo, Geometry |

如果新文章跨多个簇（如一篇讲 Transformer 内部训练机制的文章），正文可以自然引用相关文章；但图谱结构只通过 `TOPICS` 和 `STRUCTURAL_LINKS` 维护。

**链接格式**：标准 markdown 链接 `[显示文字](/blog/slug)`，显示文字可以是文章标题、关键概念名、或描述性短语。避免裸链接。

**反向引用的位置选择（仅用于文章阅读体验，不影响知识图谱）**：
- 前言末尾：「本文是 [xxx](/blog/xxx) 的延伸/补充」
- 相关章节内：在讨论相关概念时自然提及
- 结语前：「更多关于 xxx 的讨论，参见 [xxx](/blog/xxx)」

**注意**：`group` 不再依赖链接结构自动计算。没有 `group` 且没有被 `TOPICS` 覆盖的新文章会进入 fallback 节点，社区默认为 `misc`。新主题树必须添加合适的 `group`，并在需要时扩展 `GROUP_LABELS`。

### 检查清单（写完新博客后）

1. 前言是否以场景/问题开头，而不是定义开头？
2. 是否有至少一个贯穿全文的类比？
3. 编号结构是否逻辑递进，而非机械罗列？
4. 是否包含数学公式、图表、代码中的至少两种？
5. 结语是否有反思性观点，而非简单复述？
6. 是否在内容需要时添加了自然的交叉引用，而不是为了影响图谱强行加链接？
7. 是否检查并维护了 `src/utils/buildGraphData.ts` 的 `TOPICS` / `STRUCTURAL_LINKS` / `GROUP_LABELS`？
8. `npm run build --legacy-peer-deps` 是否通过？
9. `npm run test:smoke` 和 `npm run test` 是否通过？
