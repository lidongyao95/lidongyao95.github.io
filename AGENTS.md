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
group: 'training'         # 可选，知识图谱社区归属覆盖（通常不需要，自动检测即可）
---
```

标准字段只有 title、date、excerpt 三个。`group` 字段仅在知识图谱自动归类明显不符合预期时添加，可选值为现有簇名（如 `sequence`、`training`、`rag`、`agent`）。不要添加 tags、category 等。

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

博客列表页有一个知识图谱视图，自动从文章间的 `[文字](/blog/slug)` 链接构建。写新博客时，Agent 必须主动维护这个引用网络。

**写新博客时的流程：**

1. **扫描已有文章**：列出 `src/content/blog/` 下所有文件的 slug 和标题，了解现有知识图谱的全貌
2. **评估关联性**：判断新文章与哪些已有文章存在主题关联（概念前置、方法对比、系列续篇、补充深化等）
3. **在新文章中正向引用**：在相关段落自然地插入 `[文章标题](/blog/slug)` 链接，不要堆在文末
4. **在旧文章中反向引用**：在被关联的旧文章中补充指向新文章的链接（通常在前言末尾、相关章节、或结语前）
5. **评估聚类归属**：判断新文章属于已有主题簇还是全新主题（见下方簇列表）

**现有主题簇（随文章增删动态变化）：**

| 簇 | 代表文章 | 核心关键词 |
|---|---------|-----------|
| 序列建模 | rnn-lstm-gru, rnn-to-linear-attention, mamba-ssm, transformer-architecture | RNN, Attention, SSM, Linear Attention |
| 训练与对齐 | pretraining-and-finetuning, pretrain-sft-rlhf, generalization-and-interpretability, feature-vectors-in-llm | 预训练, 微调, SFT, RLHF, 对齐 |
| RAG | rag-basics, rag-engineering | 检索增强, 向量检索 |
| Agent 工程 | agent-harness-part1/2, ai-agent-skills, mcp-model-context-protocol, loop-engineering, coding-is-solved | Agent, Skill, MCP, Harness, Loop |

如果新文章跨多个簇（如一篇讲 Transformer 内部训练机制的文章），在多个簇的文章中都添加引用，让图谱自然体现桥梁关系。

**链接格式**：标准 markdown 链接 `[显示文字](/blog/slug)`，显示文字可以是文章标题、关键概念名、或描述性短语。避免裸链接。

**反向引用的位置选择**：
- 前言末尾：「本文是 [xxx](/blog/xxx) 的延伸/补充」
- 相关章节内：在讨论相关概念时自然提及
- 结语前：「更多关于 xxx 的讨论，参见 [xxx](/blog/xxx)」

**注意**：`group` 字段不需要写在 frontmatter 中——知识图谱会根据链接结构自动计算社区归属。只有当自动归类明显不符合预期时，才在 frontmatter 中添加可选的 `group: "xxx"` 覆盖。

### 检查清单（写完新博客后）

1. 前言是否以场景/问题开头，而不是定义开头？
2. 是否有至少一个贯穿全文的类比？
3. 编号结构是否逻辑递进，而非机械罗列？
4. 是否包含数学公式、图表、代码中的至少两种？
5. 结语是否有反思性观点，而非简单复述？
6. 是否在新文章中添加了至少 1 个指向已有文章的交叉引用？
7. 是否在被关联的旧文章中添加了反向引用？
8. `npm run build --legacy-peer-deps` 是否通过？
