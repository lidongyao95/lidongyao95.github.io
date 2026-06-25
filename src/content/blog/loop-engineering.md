---
title: 'Loop Engineering：不再写 Prompt，而是设计循环'
date: 2026-06-25
excerpt: '从 Addy Osmani 的五个构建模块 + Memory 出发，拆解 AI Agent 中「让循环代替人工提示」的设计范式——循环怎么搭、怎么转、怎么收敛。'
---

## 前言

2026 年 6 月，PSPDFKit 创始人 Peter Steinberger 在推文中写道：「你不应该再去手动 Prompt 编程 Agent 了。你应该设计循环来替你 Prompt Agent。」几乎同一时间，Anthropic Claude Code 负责人 Boris Cherny 表达了类似的理念：「I don't prompt Claude anymore. I have loops running that prompt Claude and figuring out what to do.」

Google Chrome 团队的 **Addy Osmani** 随后发表长文，把这些散落在开发者圈中的想法系统化为一个完整的工程框架，并正式命名为 **Loop Engineering（循环工程）**。

过去两年，开发者们用各种方式拼凑自动化循环——一堆 Bash 脚本、cron 定时任务、GitHub Actions workflow——但这些方案脆弱且难以维护。Osmani 的贡献在于指出：我们已经不需要自己造轮子了，主流 Agent 工具（Codex、Claude Code 等）已经原生支持构建循环所需的全部基础设施。

这篇文章从 Osmani 的五个构建模块 + Memory 出发，拆解 Loop Engineering 的核心设计。读完你会明白：循环系统由哪些组件构成、循环内部有哪些设计模式、以及循环失控时该怎么办。

## 1. 从 Prompt 到 Loop

### 1.1 手动提示的天花板

给 AI 写一段 prompt，得到一段输出，这是过去几年我们和 LLM 交互的标准方式。它在简单任务上很好用——翻译一句话、写一段文案、回答一个事实问题。

但对于复杂任务，这种方式有一个根本性的瓶颈：**每一次交互都需要人参与。**

你需要反复地：读 AI 的输出、判断质量、修改 prompt、再让 AI 生成、再判断、再修改……你本质上是一个「人肉循环」——手动驱动着 AI 的每一步迭代。

这就像考试时只看一遍题目就直接写答案。对于简单题可能够用，但对于复杂的应用题，你需要读题、尝试一种解法、发现行不通、换一种思路、算出中间结果、检查是否合理、不对的话回头检查、修正后继续。这个「尝试→检查→调整」的过程，如果每一步都要人来驱动，效率和可扩展性都趋近于零。

### 1.2 Loop Engineering 的核心主张

Loop Engineering 的回答是：**把你从循环里拿掉。**

不是让你不写 prompt，而是让你写的东西升级一层——从「告诉 AI 做什么」变成「设计一套系统，让 AI 自己决定做什么、怎么做、做完了没」。

用 Steinberger 的原话说：「你不应该再去手动 Prompt 编程 Agent 了。你应该设计循环来替你 Prompt Agent。」

这不是一个新技术，而是一种**范式转移**。你的身份从「操作员」变成了「架构师」——你不再亲手操作每一步，而是设计整套运转机制。就像工厂的厂长不需要亲自拧每一颗螺丝，他设计的是流水线。

## 2. 五个构建模块 + Memory：一个完整循环系统的解剖

Addy Osmani 把一个完整的 Loop 系统拆解为五个核心构建模块，外加一个贯穿始终的 Memory 层。它们不是六种技术，而是六种**角色**——每个模块回答一个特定的问题，组合起来就是一个能自主运转的 Agent 系统。

```text
┌──────────────────────────────────────────────┐
│              Loop Engineering                │
│                                              │
│  ┌────────────┐  ┌──────────┐  ┌──────────┐ │
│  │ Automations│  │ Worktrees│  │  Skills  │ │
│  │  自动调度   │  │ 隔离分支  │  │ 知识固化 │ │
│  └────────────┘  └──────────┘  └──────────┘ │
│  ┌────────────┐  ┌──────────┐               │
│  │  Plugins   │  │Sub-agents│               │
│  │  外部连接   │  │ 职责分离  │               │
│  └────────────┘  └──────────┘               │
│  ┌────────────────────────────────────────┐  │
│  │          Memory / State                │  │
│  │  跨会话持久化——记录已完成和待办事项     │  │
│  └────────────────────────────────────────┘  │
│                                              │
│              ┌──────────┐                    │
│              │   LLM    │                    │
│              └──────────┘                    │
└──────────────────────────────────────────────┘
```

### 2.1 Automations：按计划自动运行，自行发现和分类工作

**Automations 解决的核心问题是：谁来启动和驱动循环？**

Osmani 的定义很直接：Automations 是「go off on a schedule and do discovery and triage by themselves」——按计划自动触发，自己发现需要处理的工作并做分类。

一个 Automation 包含一个**触发器**（定时任务、事件监听、或手动启动）和一个**执行体**（循环体本身）。在 Claude Code 中，这对应 cron 定时任务和 hooks；在 Codex 中，对应 Automations tab 和 Triage inbox。

最简形式就是一个 `while` 循环：

```python
while not is_done(result):
    action = agent.think(context)
    result = agent.act(action)
    context.update(action, result)
    
    if cost_exceeded() or iteration_limit_reached():
        break
```

但真实的 Automation 远比这复杂。你需要考虑：多久检查一次完成条件？如果 Agent 卡在某个状态怎么强制推进？如果中间需要等待外部事件（比如等 CI 构建完成）怎么暂停和恢复？

频率控制是一个容易被忽视的设计点。太频繁浪费资源、触发 API 限流；太稀疏响应迟钝。一个好的做法是**自适应频率**——连续成功时逐步缩短间隔，连续失败时指数退避：

```text
紧急程度          推荐频率           示例
─────────────────────────────────────────────
关键（Critical）   秒级              故障检测、安全告警
高（High）        分钟级            CI 构建、消息队列处理
中（Medium）      小时级            数据同步、报告生成
低（Low）         天级              日志清理、备份验证
```

### 2.2 Worktrees：让并行工作的 Agent 不会互相踩脚

**Worktrees 解决的核心问题是：多个循环同时跑，怎么互不干扰？**

Osmani 的原话是：Worktrees 的存在「so two agents working in parallel don't step on each other」——让两个并行工作的 Agent 不会互相踩脚。

想象你让 Agent 同时修复三个 bug。如果三个任务共享同一个工作目录，修改会相互覆盖，上下文会彼此污染。Worktrees 的思路很直接：为每个循环创建一个**隔离的工作空间**——独立的文件副本、独立的上下文、独立的中间状态。

```text
主工作区
  ├── worktree-bug-001/    ← Agent A 的独立空间
  ├── worktree-bug-002/    ← Agent B 的独立空间
  └── worktree-bug-003/    ← Agent C 的独立空间
```

这个概念直接借用了 Git 的 worktree 功能——每个 worktree 是一个独立的文件树，可以独立修改和提交。但在 Agent 系统中，隔离的范围更广：不只是文件系统，还包括内存状态、对话历史、工具调用上下文。

隔离的价值不只是避免冲突，更重要的是**让每个循环的认知保持纯粹**。当一个 Agent 同时处理多个不相关的任务时，上下文窗口被各种无关信息占满，推理质量会显著下降。Worktrees 让每个循环只看到自己需要的东西。

### 2.3 Skills：把项目知识写下来，让 Agent 不再瞎猜

**Skills 解决的核心问题是：怎么避免每次都从零开始解释？**

Osmani 的定义是：Skills 用来「write down the project knowledge the agent would otherwise just guess」——把 Agent 原本只能猜测的项目知识固化下来。

每次启动一个新的循环，你不想重新告诉 Agent：这个项目用什么框架、代码风格是什么、测试怎么跑、部署流程是怎样的。Skills 把这些**项目知识和领域约定固化为文件**，让 Agent 在每次循环开始时自动加载。

```text
skills/
  ├── coding-standards.md     ← 代码规范
  ├── project-architecture.md ← 项目架构说明
  ├── testing-guide.md        ← 测试策略
  └── domain-glossary.md      ← 领域术语表
```

Skills 和 prompt 的区别在于**持久性和复用性**。Prompt 是一次性的——用完即弃。Skills 是结构化的知识文件——一次编写、反复使用、持续维护。它们就像给新员工准备的入职手册，不管换了多少个员工来执行任务，手册始终在那里。

这也是 Osmani 框架中最容易被低估的一个模块。很多人花了大量精力设计循环逻辑，却忽略了把项目知识喂给 Agent。结果就是：循环跑得很快，但每轮都在犯同样的低级错误——因为它根本不知道项目的约定。

### 2.4 Plugins & Connectors：把 Agent 接入你已经使用的工具

**Plugins & Connectors 解决的核心问题是：循环怎么和真实世界交互？**

Osmani 的定义是：它们用来「plug the agent into the tools you already use」——把 Agent 接入你已经在用的工具。

LLM 本身只能生成文本。要让 Agent 真正「做事」——搜索网页、读写文件、调用 API、查询数据库、触发 CI 构建——需要一层连接器把外部系统的能力暴露给循环。

这是五个模块中**最依赖 Harness 层**的一块。Harness 负责工具集成和安全控制（详见 [Agent Harness 工程（上）](/blog/agent-harness-part1) §3），Loop 消费这些能力来驱动迭代。

一个典型的连接器配置：

```yaml
connectors:
  - name: github
    actions: [create_issue, read_pr, merge_branch]
  - name: ci_cd
    actions: [trigger_build, get_status, read_logs]
  - name: slack
    actions: [send_message, read_channel]
```

连接器的设计原则是**最小权限**：循环只暴露它需要的工具和操作，不要给它 root 权限。这是安全的基本底线。

### 2.5 Sub-agents：一个负责产出想法，另一个负责检查

**Sub-agents 解决的核心问题是：一个 Agent 又做又审，怎么保证不自我欺骗？**

Osmani 的定义是：Sub-agents 的存在「so one of them has the idea and a different one checks it」——让一个 Agent 负责生成，另一个负责审查。

让同一个 Agent 生成代码再审查自己的代码，效果很差——就像让考生批改自己的试卷。Sub-agents 的思路是把**生成和验证分离给不同的 Agent**：

```text
Coder Agent: 生成代码 v1
    ↓
Reviewer Agent: 发现问题 X 和 Y
    ↓
Coder Agent: 修复 X 和 Y，生成 v2
    ↓
Reviewer Agent: X 已修复，Y 的修复引入了 Z
    ↓
Coder Agent: 修复 Z，生成 v3
    ↓
Reviewer Agent: 全部通过 ✓
```

这种「编码者-审查者」的对话循环是多 Agent 协作中最实用的模式。它的价值不只是交叉验证，还在于**角色清晰**：Coder 不改审查意见，Reviewer 不改代码。职责边界让每个 Agent 的推理更专注。

当两个 Sub-agent 陷入僵局（互相否定对方的修改），需要引入冲突解决机制——可以是一个第三方的仲裁 Agent，也可以是直接升级到人类决策者。

### 2.6 Memory / State：让模型记住跨会话的状态

**Memory 解决的核心问题是：模型每次运行之间会忘记一切。**

在 Osmani 的框架中，Memory 不是一个独立的构建模块，而是贯穿其他五个模块的**横切关注点**。他的定义是：你需要一个地方「to remember stuff」——记录已完成和待办事项，弥补「the model forgets everything between runs」的缺陷。

Memory 的典型载体是 Markdown 文件（如 `AGENTS.md`、`SKILL.md`）或外部任务看板（如 Linear、GitHub Issues）。它们让状态在会话之间延续。

```text
工作记忆（当前轮次的上下文）
    ↓ 超出窗口时压缩
短期记忆（会话历史的摘要）
    ↓ 会话结束时归档
长期记忆（跨会话的知识和教训）
```

循环内的状态传递是最基本的需求——每一轮的 thought、action、observation 需要追加到上下文中。但更复杂的是**跨循环的状态管理**：上一次循环失败了，失败原因和反思应该带入下一次循环，避免重蹈覆辙。

这也是 Reflexion 框架（Shinn et al., NeurIPS 2023）的核心洞察——反思不是只在循环内部有用，跨循环的反思记忆才是 Agent 「学习」的真正来源。

## 3. 循环的设计模式

五个构建模块 + Memory 搭好了循环的骨架。接下来是循环内部怎么「转」的问题——每一轮迭代中，Agent 怎么思考、怎么行动、怎么从结果中学习。

### 3.1 ReAct：思考-行动-观察

ReAct（Reasoning + Acting）由 Yao 等人在 2022 年提出，是目前最基础的循环模式。

每一轮循环做三件事：先**思考**（Thought）当前情况，再**行动**（Action）调用工具，然后**观察**（Observation）工具返回了什么，如此循环：

```text
while not done:
    thought  = llm("根据当前情况，我应该做什么？")
    action   = llm("执行什么具体操作？")
    observation = execute(action)
    context += f"Thought: {thought}\nAction: {action}\nObservation: {observation}"
```

ReAct 有效的原因是三个设计选择：**显式推理**——thought 步骤强制 Agent 在行动前思考，减少盲目尝试；**观察反馈**——observation 把执行结果反馈给 Agent，让它知道行动的后果；**增量积累**——每步的上下文逐步增长，Agent 的「认知」随着循环不断丰富。

但 ReAct 也有天花板：每一步只看眼前，不做全局规划；早期错误会级联影响后续所有步骤；不会从失败中学习。这些局限催生了更高级的循环模式。

### 3.2 生成-检查-修复

在实际 Agent 系统中，最实用的循环模式是**生成-检查-修复（Generate-Verify-Fix）**：

```text
while not passed:
    solution = generate(context)
    result   = verify(solution)
    if result.passed:
        break
    context += f"尝试: {solution}\n结果: {result.error}\n请修复上述问题。"
    attempts += 1
    if attempts >= max_attempts:
        return best_solution_so_far
```

这个循环的关键在 **verify** 步骤——它提供了客观的反馈信号。没有验证，Agent 不知道自己做得对不对，循环就没有方向。

不同的任务有不同的验证方式：

| 任务类型 | 验证方式 | 可靠性 |
|----------|----------|--------|
| 代码生成 | 单元测试 | 高（客观） |
| 数学推理 | 代入验证 | 高 |
| 数据分析 | 结果合理性检查 | 中 |
| 文本翻译 | LLM 评估 | 中（主观） |
| 创意写作 | 人类反馈 | 低（高度主观） |

验证越客观，循环越有效。这就是为什么代码类 Agent 发展最快——它们有最强的验证信号（测试通过/失败）。Lightman 等人（ICLR 2024）在 **Let's Verify Step by Step** 中进一步证明，对推理过程的每一步（而非仅最终答案）给予奖励信号，可以显著提升准确率。这种「过程监督」本质上是一种细粒度的验证循环。

> 📄 **Let's Verify Step by Step**
> Lightman, Kosaraju, Burda, et al. ICLR 2024.
> 证明过程监督（逐步奖励）显著优于结果监督，在 MATH 基准上达到 78% 准确率。

### 3.3 Reflexion：从失败中学习

Shinn 等人在 2023 年提出的 Reflexion，在 ReAct 的基础上增加了一层**跨 episode 的反思循环**：

```text
for episode in range(max_episodes):
    trajectory = react_loop(task)
    success = evaluate(trajectory)

    if success:
        break

    reflection = llm(f"""
    任务: {task}
    我的尝试: {trajectory}
    结果: 失败

    请分析：
    1. 我哪里做错了？
    2. 根本原因是什么？
    3. 下次应该怎么做？
    """)

    memory.append(reflection)
```

没有反思的 Agent，每次失败都从同一个起点重新开始。有反思的 Agent，会把上次的教训带入下次尝试：

```text
Episode 1: 失败（用了递归，栈溢出）
反思: "N 很大时递归会栈溢出，应该用迭代或动态规划"

Episode 2: 失败（迭代版本有 off-by-one error）
反思: "循环边界要注意，N=0 和 N=1 是边界情况"

Episode 3: 成功（迭代 + 正确处理边界）
```

反思可以在不同层次上发生：**战术反思**修正具体操作（「API 参数格式不对」），**策略反思**调整整体方法（「不该用正则，应该用 JSON 解析器」），**元认知反思**评估自身能力边界（「这类问题我不擅长，应该先搜索文档」）。

> 📄 **Reflexion: Language Agents with Verbal Reinforcement Learning**
> Shinn, Cassano, Gopinath, et al. NeurIPS 2023.
> 提出语言形式的自我反思机制，让 Agent 通过自然语言从失败中学习。

### 3.4 规划循环与树搜索

单纯的 ReAct 循环是局部最优的——每一步只看眼前。规划循环引入了全局视角：

```text
plan = llm("制定一个分步计划来完成这个任务")

for step in plan:
    result = execute(step)
    assessment = llm(f"步骤 '{step}' 的结果: {result}。计划需要调整吗？")

    if assessment.needs_revision:
        plan = revise_plan(plan, assessment)
```

真正有用的规划循环需要**动态重规划**的能力——条件分支（根据中间结果选择不同路径）、回退机制（走不通时回到决策点）、目标调整（发现不可行时降低期望）。

Yao 等人在 2023 年提出的 **Tree of Thoughts（ToT）** 把规划建模为搜索问题：

```text
           [初始状态]
          /    |    \
    [思路A]  [思路B]  [思路C]
     /  \      |        \
  [A1] [A2]  [B1]      [C1]
   |              ↗ 最有希望的路径
  [A1a]
```

每一步生成多个候选思路，用评估函数判断哪些最有希望，沿最有希望的路径继续探索。代价是计算量大——工程中通常用 Beam Search 控制搜索空间。

> 📄 **Tree of Thoughts: Deliberate Problem Solving with Large Language Models**
> Yao, Yu, Zhao, et al. NeurIPS 2023.
> 把 LLM 推理建模为树搜索问题，通过生成、评估和回溯找到最优推理路径。

## 4. 收敛：循环什么时候该停

循环设计中最棘手的问题不是「怎么转」，而是「什么时候停」。一个没有收敛机制的循环，就是一颗定时炸弹。

### 4.1 不收敛的三种形态

**震荡。** Agent 在两个错误之间反复横跳——改了 A 坏了 B，改了 B 又坏了 A。像在两个局部最优之间打乒乓球。

**退化。** 每次修复引入新问题，代码质量越来越差。Agent 越改越乱，像一个越补越破的补丁。

**卡死。** Agent 反复尝试同一种（错误的）修复方式，无法跳出思维定势。它不是不努力，而是被困在了同一个思路里。

这三种形态的共同特征是：循环在跑，但不在前进。

### 4.2 收敛检测

怎么判断循环是否在取得进展？一个工程化的做法是监控循环的历史状态：

```python
def is_converging(history, window=3):
    if len(history) < window:
        return True  # 历史太短，继续观察

    recent = history[-window:]

    # 停滞检测：连续 N 轮改进 < 阈值
    improvements = [history[i].score - history[i-1].score
                    for i in range(-window+1, 0)]
    if all(imp < 0.01 for imp in improvements):
        return False

    # 震荡检测：指标在两个值之间反复
    if len(set(recent)) <= 2 and len(recent) >= 4:
        return False

    # 退化检测：指标持续下降
    if all(recent[i].score < recent[i-1].score
           for i in range(1, len(recent))):
        return False

    return True
```

### 4.3 退出策略

检测到不收敛（或达到正常完成条件）时，循环需要一套清晰的退出策略：

**最大迭代次数。** 设置硬性上限（通常 3-5 次）。超过就终止，返回当前最佳结果。

**温度递增。** 随着迭代次数增加，逐步提高 LLM 的 temperature，鼓励更大胆的尝试——这有助于打破震荡和卡死。

**策略切换。** 连续两次修复失败后，要求 Agent 换一个完全不同的思路，而不是在原有方案上微调。

**人类介入。** 所有自动策略都失败时，把问题和已尝试的方案呈现给用户，请求指导。

把这些组合在一起，就是一个 LoopGuard——循环的「安全刹车」：

```python
class LoopGuard:
    def __init__(self, max_iterations=10, max_repeated=3):
        self.max_iterations = max_iterations
        self.max_repeated = max_repeated
        self.history = []
        self.repeated_count = 0
        self.last_action = None

    def check(self, action):
        self.history.append(action)

        if len(self.history) >= self.max_iterations:
            raise LoopError("达到最大迭代次数")

        if action == self.last_action:
            self.repeated_count += 1
            if self.repeated_count >= self.max_repeated:
                raise LoopError("检测到重复动作")
        else:
            self.repeated_count = 0
            self.last_action = action

        if len(self.history) > 4:
            for i in range(len(self.history) - 4):
                if self.history[i:i+2] == self.history[i+2:i+4]:
                    raise LoopError("检测到状态循环")
```

## 5. 工程规格：让循环可预测

一个好的循环不只是能跑起来，还要**行为可预测、可审计、可调试**。这需要一份明确的工程规格。

### 5.1 循环规范的三要素

每一个投入生产的循环都应该定义清楚三件事：

**入口条件。** 什么事件触发循环？前置条件是什么？（资源够不够？依赖就绪了没有？是不是重复触发了？）

**退出条件。** 成功退出的标准是什么？（测试全通过？覆盖率达标？）失败退出的阈值是什么？（最多迭代几次？最大花多少钱？最长跑多久？）

**预算控制。** 这个循环允许消耗多少 token、多少 API 调用、多少时间？简单任务给小预算，复杂任务给大预算。

```yaml
loop_spec:
  name: "bug_fix_loop"
  frequency:
    min_interval: 5s
    max_interval: 5m
    adaptive: true
  entry:
    triggers:
      - type: "event"
        source: "issue_tracker"
        event: "bug_assigned"
    preconditions:
      - check: "not_duplicate"
        key: "bug_id"
  exit:
    success:
      - "tests_pass"
      - "no_lint_errors"
    failure:
      max_iterations: 10
      max_cost: "$5.00"
      timeout: "30m"
  on_exit:
    save_checkpoint: true
    notify: ["developer"]
    fallback: "human_review"
```

### 5.2 模式选择指南

不同的任务适合不同的循环模式。一个简单的选择框架：

| 任务类型 | 推荐循环模式 | 理由 |
|----------|-------------|------|
| 代码生成/修复 | 生成-检查-修复 | 有客观验证信号（测试） |
| 信息检索 | ReAct | 需要多步搜索和综合 |
| 复杂推理 | Tree of Thoughts | 需要探索多条路径 |
| 长期任务 | Plan-Execute-Reflect | 需要全局规划和动态调整 |
| 代码审查 | Sub-agent 对话循环 | 需要不同视角的交叉验证 |
| 学习类任务 | Reflexion | 需要从失败中积累经验 |

实际系统中，多种模式经常组合使用——外层 Plan-Execute-Reflect 做全局规划，中层 ReAct 做任务执行，内层 Generate-Verify-Fix 做代码验证。循环的嵌套和组合，正是 Loop Engineering 从「单循环脚本」进化为「系统级架构」的关键一步。

## 结语

Loop Engineering 的核心洞察，其实用一句话就能说清楚：**智能不是单次推理的产物，而是迭代过程的涌现。**

一个只做一次推理的 LLM，和一个会循环迭代的 Agent，能力差距可能是质的飞跃。循环让 Agent 能够纠错、学习、规划、协作——这些都不是一次性计算能做到的。

但更重要的是 Loop Engineering 带来的**身份转变**。程序员正在从「写代码的人」变成「设计循环的人」——你不再亲手操作每一步，而是设计一套让系统自主运转的机制。Osmani 的五个构建模块 + Memory 给了这套机制一个清晰的骨架：Automations 自动调度，Worktrees 隔离并行，Skills 固化知识，Connectors 连接外部工具，Sub-agents 分离职责，Memory 延续状态。

值得注意的是，2024-2025 年间出现了一批将循环能力「内化」到模型本身的突破。OpenAI 的 **o1/o3** 和 DeepSeek 的 **DeepSeek-R1** 展示了模型在回答之前进行长时间内部推理的能力——自我修正、回溯验证和策略切换这些原本需要外部 Harness 实现的循环行为，开始出现在模型权重中。Wang 等人（2026）在 **Agent Cybernetics** 中进一步提出，应该用控制论的框架来分析和设计 Agent 的循环行为——「感知-推理-行动-修正」的反馈循环，本质上是经典控制论中稳态机制的现代版本。

这些方向暗示着 Loop Engineering 的未来：循环逻辑可能从外部脚手架逐步迁移到模型内部，而我们的角色从「驱动循环」变成「监督循环」。但无论循环在哪里执行，设计循环的人——而不是在循环里执行的人——才是这个新范式中最重要的角色。

## 参考文献

Osmani, A. (2026). *Loop Engineering*. https://addyosmani.com/blog/loop-engineering/

Yao, S., Zhao, J., Yu, D., et al. (2023). *ReAct: Synergizing Reasoning and Acting in Language Models*. ICLR 2023. https://arxiv.org/abs/2210.03629

Shinn, N., Cassano, F., Gopinath, A., et al. (2023). *Reflexion: Language Agents with Verbal Reinforcement Learning*. NeurIPS 2023. https://arxiv.org/abs/2303.11366

Yao, S., Yu, D., Zhao, J., et al. (2023). *Tree of Thoughts: Deliberate Problem Solving with Large Language Models*. NeurIPS 2023. https://arxiv.org/abs/2305.10601

Lightman, H., Kosaraju, V., Burda, Y., et al. (2024). *Let's Verify Step by Step*. ICLR 2024. https://arxiv.org/abs/2305.20050

OpenAI. (2024). *Introducing OpenAI o1*. https://openai.com/index/introducing-openai-o1-preview/

OpenAI. (2025). *Introducing o3 and o4-mini*. https://openai.com/index/introducing-o3-and-o4-mini/

DeepSeek-AI. (2025). *DeepSeek-R1: Incentivizing Reasoning Capability in LLMs via Reinforcement Learning*. https://arxiv.org/abs/2501.12948

Wang, X., Yang, C., Zhao, H., et al. (2026). *The Agent Use of Agent Beings: Agent Cybernetics Is the Missing Science of Foundation Agents*. https://arxiv.org/abs/2605.10754
