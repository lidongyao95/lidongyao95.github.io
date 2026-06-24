---
title: 'Loop Engineering：让 AI Agent 学会「转圈」的艺术'
date: 2026-06-24
excerpt: '从 ReAct 到 Reflexion，拆解 AI Agent 中的各种循环模式——为什么循环、怎么循环、以及循环失控时怎么办。'
---

## 前言

你有没有注意过，人类解决复杂问题的方式几乎从来不是一次到位的？

写代码时，你写一版、跑一遍、看报错、改一版、再跑一遍。做研究时，你读论文、形成假设、找证据、修正假设、再读更多论文。调试系统时，你猜测原因、验证猜测、排除错误、换个方向再猜。

这些过程有一个共同特征：**它们都是循环。** 不是一次性的线性流程，而是反复迭代的螺旋上升。

AI Agent 也一样。一个真正有用的 Agent 不是「收到指令→一次输出→结束」，而是「行动→观察→反思→调整→再行动」的循环。这种循环能力，是 Agent 从「单次推理器」进化为「持续问题解决者」的关键。

但循环也是最容易出问题的地方。无限循环、死胡同、资源耗尽、收敛失败——这些工程挑战让循环设计成为 Agent 开发中最棘手的部分之一。

这篇文章把这种能力叫做 **Loop Engineering（循环工程）**——不是某一种具体技术，而是围绕「如何让 Agent 有效地迭代」的一整套设计理念和工程实践。

## 1. 为什么需要循环

### 1.1 单次推理的天花板

一个没有循环的 Agent，本质上就是一个函数：`output = agent(input)`。

这在简单任务上没问题——翻译一句话、回答一个事实问题、生成一段文案。但对于复杂任务，单次推理几乎注定不够：

**信息不完整。** 你可能需要搜索、读取、分析多轮信息才能凑齐答案。

**结果不确定。** 第一次尝试可能失败，需要调整策略重试。

**质量要求高。** 一次生成的代码可能有 bug，需要测试、修复、再测试。

**任务本质是迭代的。** 「写一篇好文章」不可能一步到位——它需要写、改、写、改、再改的循环。

### 1.2 一个类比：考试与复习

单次推理就像考试时只看一遍题目就直接写答案。对于简单题可能够用，但对于复杂的应用题，你需要：

1. 读题，理解要求
2. 尝试一种解法
3. 发现行不通，换一种思路
4. 算出中间结果，检查是否合理
5. 如果不对，回头检查哪步出了错
6. 修正后继续

这个「尝试→检查→调整」的循环，就是 Loop Engineering 要解决的问题。

## 2. 基础循环：ReAct

### 2.1 最经典的循环模式

ReAct（Reasoning + Acting）由 Yao 等人在 2022 年提出，是目前最广泛使用的 Agent 循环模式。

核心思路极其简单：在每一步中，Agent 先**思考**（Thought），再**行动**（Action），然后**观察**（Observation），如此循环。

```text
while not done:
    thought  = llm("根据当前情况，我应该做什么？")
    action   = llm("执行什么具体操作？")
    observation = execute(action)
    context += f"Thought: {thought}\nAction: {action}\nObservation: {observation}"
```

### 2.2 为什么 ReAct 有效

ReAct 的有效性来自三个设计选择：

**显式推理。** `thought` 步骤强制 Agent 在行动前进行推理，而不是直接跳到动作。这减少了盲目尝试。

**观察反馈。** `observation` 把工具的执行结果反馈给 Agent，让它知道行动的后果。没有这个反馈，Agent 就是在黑暗中摸索。

**增量积累。** 每一步的 thought/action/observation 都追加到上下文中，Agent 的「认知」随着循环逐步增长。

### 2.3 ReAct 的局限

ReAct 虽然是基础，但它有明显的天花板：

**没有全局规划。** 每一步只考虑当前状态，不考虑整体目标。容易陷入局部最优。

**错误会累积。** 早期的错误推理会影响后续所有步骤。一个错误的 thought 可能导致一连串无用的 action。

**缺乏反思。** Agent 不会回头看自己走过的路径，不会从失败中学习。每次失败都从同一个地方重新尝试。

这些局限催生了更高级的循环模式。

## 3. 验证循环：生成-检查-修复

### 3.1 最常见的工程循环

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

### 3.2 代码生成的典型循环

以代码生成为例：

```text
用户: "写一个 Python 函数，计算斐波那契数列的第 N 项"

循环 1:
  Agent 生成代码 → 运行测试 → 发现大数性能差
  Agent: "用迭代代替递归，加入缓存"

循环 2:
  Agent 修改代码 → 运行测试 → 全部通过
  Agent: "完成"
```

这个循环的关键是 **verify** 步骤——它提供了客观的反馈信号。没有验证，Agent 不知道自己写得对不对，循环就没有意义。

### 3.3 验证方式的分类

不同的任务有不同的验证方式：

| 任务类型 | 验证方式 | 可靠性 |
|----------|----------|--------|
| 代码生成 | 单元测试 | 高（客观） |
| 代码修复 | 编译+测试 | 高 |
| 数学推理 | 代入验证 | 高 |
| 文本翻译 | LLM 评估 | 中（主观） |
| 创意写作 | 人类反馈 | 低（高度主观） |
| 数据分析 | 结果合理性检查 | 中 |

验证越客观，循环越有效。这就是为什么代码类 Agent 发展最快——它们有最强的验证信号（测试通过/失败）。

这个思路在学术上也得到了验证。Lightman 等人（ICLR 2024）在 **Let's Verify Step by Step** 中证明，对推理过程的每一步（而不仅仅是最终答案）给予奖励信号，可以显著提升数学推理的准确率。这种「过程监督」本质上就是一种细粒度的验证循环——不是等到最后才检查，而是每一步都有反馈。

> 📄 **Let's Verify Step by Step**
> Lightman, Kosaraju, Burda, et al. ICLR 2024.
> 证明过程监督（逐步奖励）显著优于结果监督，在 MATH 基准上达到 78% 准确率。

### 3.4 收敛性问题

生成-检查-修复循环最常见的问题是**不收敛**：Agent 改来改去，始终通不过验证。

**震荡。** Agent 在两个错误之间反复横跳——改了 A 坏了 B，改了 B 又坏了 A。

**退化。** 每次修复引入新问题，代码质量越来越差。

**卡死。** Agent 反复尝试同一种（错误的）修复方式，无法跳出思维定势。

工程上的应对策略：

**最大迭代次数。** 设置硬性上限（通常 3-5 次）。超过就终止，返回当前最佳结果。

**温度递增。** 随着迭代次数增加，逐步提高 LLM 的 temperature 参数，鼓励更「大胆」的尝试。

**策略切换。** 如果连续两次修复失败，要求 Agent 换一个完全不同的思路，而不是在原有方案上微调。

**人类介入。** 达到最大迭代次数后，把问题和尝试过的方案呈现给用户，请求指导。

## 4. 反思循环：从错误中学习

### 4.1 Reflexion：让 Agent 记住教训

Shinn 等人在 2023 年提出的 Reflexion 框架，在 ReAct 的基础上增加了一层**反思循环**：

```text
for episode in range(max_episodes):
    # 标准 ReAct 循环
    trajectory = react_loop(task)
    success = evaluate(trajectory)

    if success:
        break

    # 反思：从失败中学习
    reflection = llm(f"""
    任务: {task}
    我的尝试: {trajectory}
    结果: 失败

    请分析：
    1. 我哪里做错了？
    2. 根本原因是什么？
    3. 下次应该怎么做？
    """)

    # 把反思存入记忆
    memory.append(reflection)
```

### 4.2 反思的价值

反思循环的核心价值是**跨 episode 的知识传递**。

没有反思的 Agent，每次失败都从同一个起点重新开始。有反思的 Agent，会把上次的教训带入下次尝试：

```text
Episode 1: 失败（用了递归，栈溢出）
反思: "N 很大时递归会栈溢出，应该用迭代或动态规划"

Episode 2: 失败（迭代版本有 off-by-one error）
反思: "循环边界要注意，N=0 和 N=1 是边界情况"

Episode 3: 成功（迭代 + 正确处理边界）
```

### 4.3 反思的层次

反思可以在不同层次上发生：

**战术反思。** 关于具体操作的反思。「这个 API 的参数格式不对，应该用 snake_case 而不是 camelCase。」

**策略反思。** 关于整体方法的反思。「我一开始就不应该尝试正则表达式，这种结构化数据应该用 JSON 解析器。」

**元认知反思。** 关于自身能力边界的反思。「这类问题我不太擅长，应该先搜索相关文档再尝试。」

不同层次的反思适用于不同场景。战术反思帮助修复具体错误，策略反思帮助避免方向性错误，元认知反思帮助 Agent 更准确地评估自己的能力。

> 📄 **Reflexion: Language Agents with Verbal Reinforcement Learning**
> Shinn, Cassano, Gopinath, et al. NeurIPS 2023.
> 提出语言形式的自我反思机制，让 Agent 通过自然语言从失败中学习。

## 5. 规划循环：从局部到全局

### 5.1 Plan-Execute-Reflect

单纯的 ReAct 循环是局部最优的——每一步只看眼前。规划循环引入了全局视角：

```text
# 规划阶段
plan = llm("制定一个分步计划来完成这个任务")

for step in plan:
    # 执行阶段
    result = execute(step)

    # 反思阶段
    assessment = llm(f"步骤 '{step}' 的结果: {result}。计划需要调整吗？")

    if assessment.needs_revision:
        plan = revise_plan(plan, assessment)
```

### 5.2 规划循环的关键：动态重规划

静态计划几乎不可能在复杂任务中成功。真正有用的规划循环需要**动态重规划**的能力：

**条件分支。** 根据中间结果选择不同的后续步骤。

```text
计划:
  1. 收集数据
  2. 清洗数据
  3. if 数据量 > 1000:
       用批量处理
     else:
       逐条处理
  4. 生成报告
```

**回退机制。** 发现某条路走不通时，回到上一个决策点，尝试另一个分支。

```text
执行步骤 3（批量处理）→ 失败（内存不足）
回退到决策点 → 改用流式处理 → 成功
```

**目标调整。** 发现原定目标不可行时，调整目标而不是死磕。

```text
原目标: "让测试 100% 通过"
执行后发现: 有 2 个测试涉及已废弃的 API
调整目标: "让非废弃相关的测试 100% 通过，废弃相关测试标记为 skip"
```

### 5.3 Tree of Thoughts：搜索式规划

Yao 等人在 2023 年提出的 Tree of Thoughts（ToT）把规划建模为一个**搜索问题**：

```text
           [初始状态]
          /    |    \
    [思路A]  [思路B]  [思路C]
     /  \      |        \
  [A1] [A2]  [B1]      [C1]
   |              ↗ 最有希望的路径
  [A1a]
```

每一步，Agent 生成多个候选思路（thought），用一个评估函数判断哪些最有希望，然后沿着最有希望的路径继续探索。如果一条路走不通，回溯到上一个节点，尝试其他分支。

这种方法的代价是计算量大——每个节点可能产生多个分支，树的大小指数增长。工程中通常用 Beam Search（只保留 top-K 最有希望的分支）来控制搜索空间。

> 📄 **Tree of Thoughts: Deliberate Problem Solving with Large Language Models**
> Yao, Yu, Zhao, et al. NeurIPS 2023.
> 把 LLM 推理建模为树搜索问题，通过生成、评估和回溯找到最优推理路径。

## 6. 协作循环：多 Agent 的交互

### 6.1 对话式循环

在多 Agent 系统中，循环发生在 Agent 之间：

```text
while not converged:
    agent_a_message = agent_a.generate(context)
    context += agent_a_message

    agent_b_message = agent_b.generate(context)
    context += agent_b_message

    if is_resolved(context):
        break
```

这种模式常见于「编码者-审查者」场景：

```text
Coder: 生成代码 v1
Reviewer: 发现问题 X 和 Y
Coder: 修复 X 和 Y，生成 v2
Reviewer: X 已修复，但 Y 的修复引入了 Z
Coder: 修复 Z，生成 v3
Reviewer: 全部通过 ✓
```

### 6.2 收敛保证

多 Agent 协作循环需要更严格的收敛保证：

**轮次限制。** 设置最大交互轮次。超过就强制终止，由人类仲裁。

**共识机制。** 定义明确的「完成」标准。比如两个 Agent 连续两轮都给出正面评价。

**冲突检测。** 当两个 Agent 陷入僵局（互相否定对方的修改），引入第三个 Agent 或人类来打破。

**角色清晰。** 每个 Agent 的职责边界明确。Coder 不改 review 意见，Reviewer 不改代码。

### 6.3 层级循环

更复杂的系统使用层级循环——外层循环管理 Agent 间的协作，内层循环管理单个 Agent 的推理：

```text
# 外层循环：任务分配与协调
for task in decomposed_tasks:
    # 内层循环：单个 Agent 的 ReAct 执行
    agent = assign_agent(task)
    result = agent.react_loop(task)

    # 质量检查
    if not quality_check(result):
        reassign_or_revise(task)
```

## 7. 循环的工程挑战

### 7.1 无限循环

这是最经典的工程问题。Agent 可能陷入：

**同一动作重复。** 反复调用同一个工具，参数不变，期望不同结果。

**来回震荡。** 在两个状态之间反复切换，永远到不了第三个状态。

**缓慢发散。** 每次迭代都「改进」一点点，但永远达不到完成标准。

**应对策略：**

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

        # 硬性迭代上限
        if len(self.history) >= self.max_iterations:
            raise LoopError("达到最大迭代次数")

        # 重复动作检测
        if action == self.last_action:
            self.repeated_count += 1
            if self.repeated_count >= self.max_repeated:
                raise LoopError("检测到重复动作")
        else:
            self.repeated_count = 0
            self.last_action = action

        # 循环检测（检查是否回到之前某个状态）
        if len(self.history) > 4:
            for i in range(len(self.history) - 4):
                if self.history[i:i+2] == self.history[i+2:i+4]:
                    raise LoopError("检测到状态循环")
```

### 7.2 成本失控

每一次循环都消耗 token 和 API 调用。一个失控的循环可能在一分钟内烧掉几美元的 API 费用。

**Token 预算。** 为每次任务设置总 token 上限。当接近上限时，强制进入收尾阶段。

**成本估算。** 在每次迭代前估算本轮成本，如果累计成本超过阈值，提前终止。

**指数退避。** 对于重试类循环，使用指数退避策略——每次等待时间翻倍，避免高频无效调用。

**分级预算。** 简单任务给小预算（1000 token），复杂任务给大预算（10000 token）。预算不够时降级到更简单的策略。

### 7.3 上下文溢出

循环越多，上下文越长。当上下文超过模型窗口时，必须压缩或截断。

**滑动窗口。** 只保留最近 N 轮的完整记录，更早的内容压缩成摘要。

**关键信息提取。** 不是每轮信息都同等重要。提取关键决策点、错误和教训，丢弃中间的尝试过程。

**外部存储。** 把完整的循环历史存储到外部数据库，上下文中只保留当前轮次和摘要。

### 7.4 调试困难

循环中的 bug 比单次调用难调试得多。一个在第 5 轮出现的问题，可能是第 2 轮的某个错误推理导致的。

**详细日志。** 记录每一轮的完整输入/输出、工具调用参数和返回值、LLM 的原始响应。

**断点回放。** 能够从任意一轮的状态「重放」后续过程，用于复现和调试。

**可视化。** 把循环过程可视化为时间线或流程图，一眼看出在哪一步出了问题。

```text
Round 1: Thought → Action(search) → Observation ✓
Round 2: Thought → Action(read) → Observation ✓
Round 3: Thought → Action(edit) → Observation ✗ ← 这里出错
Round 4: Thought → Action(edit) → Observation ✗ ← 在修复 Round 3 的问题
Round 5: Thought → Action(test) → Observation ✓
```

## 8. 循环 vs 定时任务：两种「重复」的区别

在讨论 Agent 的重复行为时，有一个容易混淆的概念需要厘清：**循环（Loop）**和**定时任务（Scheduled Task / Cron Job）**。

它们表面上看起来都是「重复执行」，但本质上是两种完全不同的机制。

### 8.1 核心区别

**循环是任务内部的迭代。** 一次任务执行中，Agent 反复执行「思考→行动→观察」直到完成。循环的驱动力是任务本身的复杂度——任务没完成，循环就继续。

**定时任务是任务外部的触发。** 一个调度器在固定时间或固定间隔启动一次独立的任务执行。每次触发都是一个全新的任务，和上一次执行没有上下文关联。

```text
循环（Loop）—— 一次任务内部的迭代：
┌────────────────────────────────────────┐
│  Task: "修复这个 bug"                    │
│  ┌──────┐  ┌──────┐  ┌──────┐          │
│  │Round1│→│Round2│→│Round3│→ 完成 ✓   │
│  └──────┘  └──────┘  └──────┘          │
└────────────────────────────────────────┘

定时任务（Cron）—— 多次独立的任务触发：
┌──────┐        ┌──────┐        ┌──────┐
│Task A│        │Task B│        │Task C│
│9:00  │  ...   │9:05  │  ...   │9:10  │
│无关联│        │无关联│        │无关联│
└──────┘        └──────┘        └──────┘
```

### 8.2 对比总结

| 维度 | 循环（Loop） | 定时任务（Cron） |
|------|-------------|-----------------|
| **触发方式** | 任务未完成自动继续 | 外部调度器按时间触发 |
| **上下文** | 每轮共享上下文，累积信息 | 每次执行相互独立 |
| **终止条件** | 任务完成 / 达到上限 | 时间到了就结束 |
| **目的** | 迭代收敛到一个好的结果 | 定期执行重复性工作 |
| **典型场景** | 调试代码、搜索信息、生成-验证-修复 | 定时巡检、日报生成、数据同步 |
| **状态** | 有状态（中间结果跨轮传递） | 无状态（或依赖外部持久化） |

### 8.3 组合使用

在实际系统中，循环和定时任务经常组合使用：

**定时任务触发循环。** 一个 cron job 每天凌晨 2 点启动「检查系统健康」任务，这个任务内部使用循环来逐个检查各项指标。

**循环中嵌入定时等待。** Agent 在循环中遇到需要等待的外部条件（如等待 CI 结果），可以暂停循环，设置定时回调，等条件满足后恢复。

**定时任务间的隐式循环。** 多个定时任务通过共享的外部存储（数据库、文件）形成隐式的数据流。任务 A 写入数据，任务 B 定时读取并处理——这本质上是一个跨进程的「循环」，但每一环都是独立的定时任务。

区分这两种机制很重要，因为它决定了你该在哪里处理状态、在哪里做错误恢复、以及如何控制成本。把定时任务当成循环来设计，会导致不必要的资源浪费；把循环当成定时任务来设计，则会丢失迭代积累的认知。

## 9. 循环的真实战场：邮件与长时记忆

前面的讨论大多围绕代码生成和信息检索展开。但循环真正展现价值的地方，往往是那些跨越单次对话边界的长期任务。邮件处理和长时记忆是两个典型场景。

### 9.1 邮件：不只是一次性的读和回

处理一封邮件看起来是单次任务——读邮件、理解意图、生成回复、发送。但真实的邮件工作流远比这复杂：

**多轮协商循环。** 你收到一封会议邀请，需要确认时间。Agent 检查你的日历，发现有冲突，提议新时间，对方回复又调整，如此反复直到达成一致。这不是一个「读→回」的单次操作，而是一个跨越数小时甚至数天的协商循环。

```text
收到邀请 → 检查日历 → 发现冲突 → 提议新时间
    ↑                                    │
    └──── 对方回复调整 ← 等待对方确认 ←──┘
```

**邮件链跟踪。** 一个项目讨论可能跨越十几封邮件。Agent 需要在每次收到新邮件时，回溯整个对话链，理解上下文演变，判断是否需要自己行动。这是一个**增量理解的循环**——每封新邮件都是对整个故事的一次更新。

**批量处理中的优先级循环。** 早上打开邮箱有 50 封未读邮件。Agent 不是按时间顺序逐一处理，而是先扫描全部，按紧急程度和重要性排序，优先处理需要立即回复的，把可以稍后处理的归档。这个「扫描→分类→处理→再扫描」的循环，本质上是一种带优先级的 ReAct。

**定时与循环的交织。** 邮件场景完美展示了上一节讨论的循环与定时任务的组合：定时任务每 15 分钟检查新邮件（外部触发），收到新邮件后启动循环来处理（内部迭代）。处理过程中可能还需要等待对方回复（定时等待），形成更复杂的嵌套结构。

### 9.2 长时记忆：跨越对话边界的循环

单次对话中的循环（ReAct、生成-验证-修复）有一个隐含假设：所有上下文都在当前窗口内。但很多真实任务的信息分布在多次对话中。

**跨对话的学习循环。** 你昨天让 Agent 调试了一个 CSS 问题，今天又遇到类似的。如果 Agent 有长时记忆，它可以：

```text
今天的问题 → 检索长时记忆 → 找到昨天的解决方案
    → 尝试应用 → 发现不完全适用 → 调整方案
    → 成功后更新长时记忆（补充新发现）
```

这个循环跨越了两次独立的对话，通过长时记忆连接起来。没有长时记忆，今天的循环就得从零开始。

**记忆的衰减与强化循环。** 长时记忆不是静态存储——它需要维护。一个设计良好的 Agent 会对记忆进行定期「复习」：

- 被频繁引用的记忆得到强化（权重增加）
- 长期未被使用的记忆逐渐衰减（权重降低）
- 过时的记忆被标记或归档
- 矛盾的记忆触发冲突解决循环

这本身就是一个持续运行的循环，类似于人类大脑的遗忘曲线。

**知识的蒸馏循环。** 原始记忆是零散的对话片段。通过周期性的「蒸馏」过程，Agent 可以把多条相关记忆合并为一条结构化的知识。比如：

```text
原始记忆 1: "用户偏好 TypeScript 而不是 JavaScript"
原始记忆 2: "用户的项目使用 pnpm 而不是 npm"
原始记忆 3: "用户喜欢简洁的代码风格"
    ↓ 蒸馏循环
结构化知识: "用户画像——TypeScript + pnpm + 简洁风格"
```

**长时记忆让循环有了「复利」效应。** 单次对话中的循环解决当前问题，长时记忆中的循环让 Agent 越来越擅长解决同类问题。每解决一个问题，Agent 的知识库就多一分，下次遇到类似问题时循环的次数更少、收敛更快。这就是经验和学习的本质。

### 9.3 设计启示

邮件和长时记忆这两个场景揭示了循环设计中几个重要的原则：

**持久化状态。** 跨越对话边界的循环必须把中间状态存储到外部（数据库、文件系统），而不是依赖上下文窗口。进程崩溃、会话结束后，循环应该能从上次中断的地方恢复。

**异步友好。** 长时循环中的很多步骤需要等待外部事件（对方回复邮件、CI 构建完成、API 限流解除）。循环引擎需要支持「暂停→等待→恢复」的模式，而不是忙等待。

**增量更新。** 长时记忆不需要每次全量加载。循环的每一步只需要检索与当前上下文相关的记忆子集，避免上下文爆炸。

**优雅退化。** 长时循环可能运行数天甚至数周。当记忆库增长到很大时，系统应该能优雅地降级——减少检索范围、降低更新频率、压缩旧记忆——而不是崩溃。

## 10. 循环的规范：频率、入口与出口

设计一个循环，不只是决定「怎么循环」，更要决定「什么时候循环」、「什么时候不循环」、「什么时候停止」。没有这些规范的循环，就像一辆没有刹车的车——能跑，但很危险。

### 10.1 频率控制：多久跑一次

循环的频率直接影响系统的响应性、资源消耗和成本。频率太高，浪费资源、触发限流；频率太低，响应迟钝、错过时机。

**任务紧急程度决定频率。** 关键任务（生产环境告警、支付失败）需要秒级甚至毫秒级的循环频率。低优先级任务（日志清理、数据归档）可以小时级甚至天级。

```text
紧急程度          推荐频率           示例
─────────────────────────────────────────────
关键（Critical）   秒级              故障检测、安全告警
高（High）        分钟级            CI 构建、消息队列处理
中（Medium）      小时级            数据同步、报告生成
低（Low）         天级              日志清理、备份验证
```

**资源约束限制频率。** API 限流（rate limit）、并发上限、成本预算都是硬约束。循环频率不能超过这些约束的上限。

```python
# 自适应频率控制
class AdaptiveFrequency:
    def __init__(self, min_interval=1, max_interval=60):
        self.min_interval = min_interval
        self.max_interval = max_interval
        self.current_interval = min_interval
        self.success_count = 0
        self.failure_count = 0

    def get_next_interval(self):
        # 连续成功：逐步降低间隔（但不低于最小值）
        if self.success_count >= 5:
            self.current_interval = max(
                self.min_interval,
                self.current_interval * 0.8
            )
            self.success_count = 0

        # 连续失败：指数退避（但不超过最大值）
        if self.failure_count >= 3:
            self.current_interval = min(
                self.max_interval,
                self.current_interval * 2
            )
            self.failure_count = 0

        return self.current_interval
```

**数据新鲜度要求决定频率。** 如果数据变化快（股票行情、社交媒体），循环需要高频以获取最新信息。如果数据变化慢（用户配置、系统参数），低频即可。

**外部依赖影响频率。** 如果循环依赖外部服务（第三方 API、数据库查询），频率受限于这些服务的响应时间和可用性。等待外部响应时，循环应该暂停而不是空转。

### 10.2 入口条件：什么时候启动循环

不是所有情况都适合启动循环。明确的入口条件可以防止不必要的执行和资源浪费。

**触发事件。** 循环通常由特定事件触发：

```text
事件类型              示例
──────────────────────────────────────────────
用户请求             "帮我调试这段代码"
数据到达             新邮件、新消息、新文件
定时触发             每天凌晨 2 点、每 15 分钟
状态变化             数据库记录更新、服务状态变更
阈值触发             CPU 使用率 > 80%、队列长度 > 100
```

**前置条件检查。** 在启动循环前，验证必要条件是否满足：

```python
def can_start_loop(task):
    # 资源检查
    if not enough_resources():
        return False, "资源不足"

    # 依赖检查
    if not dependencies_met(task):
        return False, "依赖未就绪"

    # 并发检查：避免重复执行
    if is_already_running(task):
        return False, "任务已在运行"

    # 状态检查：系统是否健康
    if system_unhealthy():
        return False, "系统状态异常"

    # 优先级检查：是否有更高优先级的任务
    if has_higher_priority_task():
        return False, "等待高优先级任务"

    return True, "可以启动"
```

**幂等性保证。** 如果同一个事件可能触发多次循环（比如用户重复点击按钮），循环设计必须保证幂等性——多次执行和一次执行的结果相同。

### 10.3 退出条件：什么时候停止循环

退出条件比入口条件更重要。一个没有明确退出条件的循环，就是一个潜在的定时炸弹。

**成功退出。** 任务完成，达到预期目标：

```python
def is_success(result):
    # 代码生成：测试全部通过
    if task_type == "code_gen":
        return result.tests_passed and result.coverage > 0.8

    # 信息检索：找到足够的相关信息
    if task_type == "search":
        return len(result.relevant_docs) >= 3

    # 数据分析：生成完整报告
    if task_type == "analysis":
        return result.report_complete and result.confidence > 0.9
```

**失败退出。** 明确定义什么情况下应该放弃：

```text
失败类型              处理方式
──────────────────────────────────────────────
达到最大迭代次数       返回当前最佳结果，标记为"未完成"
超过成本预算          终止执行，返回已完成的中间结果
超时                  强制终止，记录断点以便恢复
连续失败 N 次         触发告警，请求人工介入
检测到死循环          立即终止，保存状态供分析
```

**收敛检测。** 判断循环是否在取得进展：

```python
def is_converging(history, window=3):
    if len(history) < window:
        return True  # 历史太短，继续观察

    recent = history[-window:]

    # 指标停滞：连续 N 轮改进 < 阈值
    improvements = [history[i].score - history[i-1].score
                    for i in range(-window+1, 0)]
    if all(imp < 0.01 for imp in improvements):
        return False  # 停滞

    # 震荡检测：指标在两个值之间反复跳动
    if len(set(recent)) <= 2 and len(recent) >= 4:
        return False  # 震荡

    # 退化检测：指标持续下降
    if all(recent[i].score < recent[i-1].score
           for i in range(1, len(recent))):
        return False  # 退化

    return True
```

**外部信号。** 循环可能需要响应外部事件而终止：

- 用户取消（用户点击"停止"按钮）
- 系统关闭（收到 SIGTERM 信号）
- 更高优先级任务抢占
- 依赖服务不可用

**优雅退出。** 无论哪种退出方式，都应该：

```python
def graceful_exit(loop_state, exit_reason):
    # 1. 保存当前进度
    save_checkpoint(loop_state)

    # 2. 清理临时资源
    cleanup_temp_files()
    release_locks()

    # 3. 记录退出原因
    log_exit(exit_reason, loop_state.iteration, loop_state.cost)

    # 4. 通知相关方
    notify_stakeholders(exit_reason)

    # 5. 返回结果（即使是不完整的结果）
    return loop_state.best_result
```

### 10.4 规范的工程化

把频率、入口、出口条件组合起来，形成一个完整的循环规范：

```yaml
loop_spec:
  name: "bug_fix_loop"

  # 频率控制
  frequency:
    min_interval: 5s        # 最快 5 秒一次
    max_interval: 5m        # 最慢 5 分钟一次
    adaptive: true          # 根据成功/失败自适应
    backoff_factor: 2       # 失败时退避倍数

  # 入口条件
  entry:
    triggers:
      - type: "event"
        source: "issue_tracker"
        event: "bug_assigned"
      - type: "manual"
        source: "user_request"
    preconditions:
      - check: "resource_available"
        threshold: "cpu < 80%"
      - check: "not_duplicate"
        key: "bug_id"
    priority_gate: "high"   # 只处理高优先级 bug

  # 退出条件
  exit:
    success:
      - "tests_pass"
      - "coverage >= 80%"
      - "no_lint_errors"
    failure:
      max_iterations: 10
      max_cost: "$5.00"
      timeout: "30m"
      consecutive_failures: 3
    convergence:
      stagnation_window: 3
      min_improvement: 0.01
    external_signals:
      - "user_cancel"
      - "system_shutdown"
      - "higher_priority_task"

  # 退出处理
  on_exit:
    save_checkpoint: true
    cleanup: true
    notify: ["developer", "slack_channel"]
    fallback: "human_review"
```

一个好的循环规范，让循环的行为可预测、可审计、可调试。它不只是技术实现，更是工程纪律的体现。

## 11. 循环模式的选择

### 11.1 按任务类型选择

| 任务类型 | 推荐循环模式 | 理由 |
|----------|-------------|------|
| 代码生成/修复 | 生成-检查-修复 | 有客观验证信号（测试） |
| 信息检索 | ReAct | 需要多步搜索和综合 |
| 复杂推理 | Tree of Thoughts | 需要探索多条路径 |
| 长期任务 | Plan-Execute-Reflect | 需要全局规划和动态调整 |
| 代码审查 | 多 Agent 对话循环 | 需要不同视角的交叉验证 |
| 学习类任务 | Reflexion | 需要从失败中积累经验 |

### 11.2 按复杂度选择

**简单任务（1-2 步）。** 不需要循环，直接执行。

**中等任务（3-5 步）。** ReAct 循环，配合生成-检查-修复。

**复杂任务（5+ 步）。** Plan-Execute-Reflect，配合动态重规划。

**非常复杂的任务。** 多 Agent 协作 + 层级循环。

### 11.3 组合使用

实际系统中，多种循环模式经常组合使用：

```text
外层: Plan-Execute-Reflect（全局规划）
  └── 中层: ReAct（每个子任务的执行）
       └── 内层: Generate-Verify-Fix（代码生成的验证循环）
```

## 12. 循环代替 Prompt 工程：从手写到达代

Prompt Engineering 是一门手艺，也是一门苦力活。一个好的 prompt 可能需要反复调整措辞、结构、示例，经过几十次试验才能达到理想效果。这种重复性的脑力劳动，恰恰是循环擅长的领域。

### 12.1 传统 Prompt 工程：人工迭代

典型的 Prompt 工程流程是：

```text
人类写 prompt v1 → 测试 → 发现效果不好 → 修改 prompt v2 → 测试
→ 还是不行 → 修改 v3 → 测试 → 好一点了 → 继续调整 v4...
```

这个过程有几个痛点：

**耗时。** 每次修改都需要人工思考和试验，一个复杂的 prompt 可能需要数小时甚至数天。

**主观。** 修改方向依赖人的直觉和经验，缺乏系统性。

**难以量化。** 「效果好」往往是主观判断，缺乏客观指标。

**不可复现。** 同一个人不同时间可能写出不同的 prompt，团队间更难以标准化。

循环可以把这个过程中机械化的部分自动化，让人专注于创意和判断。

### 12.2 Meta-Prompting：用 LLM 写 Prompt

最直接的自动化是**让 LLM 自己写 prompt**：

```python
def meta_prompt(task_description, example_inputs, example_outputs):
    """用 LLM 生成一个针对特定任务的 prompt"""
    meta_prompt = f"""
你是一个 Prompt Engineer。你的任务是为以下需求设计一个高质量的 prompt：

任务描述：{task_description}

示例输入：
{example_inputs}

示例输出：
{example_outputs}

请设计一个 prompt，使得 LLM 在收到类似输入时能产生类似输出。
prompt 应该：
1. 清晰定义角色和任务
2. 包含必要的上下文和约束
3. 使用有效的示例（few-shot）
4. 结构化，易于理解

输出格式：
- Prompt 正文
- 设计理由
- 预期效果
"""
    return llm(meta_prompt)
```

这本质上是一个**单轮生成**，但更强大的做法是加入**验证循环**：

```python
def prompt_optimization_loop(task, test_cases, max_iterations=10):
    """通过循环迭代优化 prompt"""

    # 初始 prompt（可以是 meta-prompting 生成的）
    current_prompt = meta_prompt(task.description, task.examples)

    for iteration in range(max_iterations):
        # 1. 测试当前 prompt
        results = []
        for test in test_cases:
            output = llm(current_prompt + test.input)
            score = evaluate(output, test.expected)
            results.append((test, output, score))

        # 2. 计算总体得分
        avg_score = sum(r[2] for r in results) / len(results)
        print(f"迭代 {iteration}: 平均分 {avg_score:.2f}")

        # 3. 检查是否达标
        if avg_score >= 0.9:
            print("✓ 达到目标分数")
            break

        # 4. 分析失败案例
        failures = [r for r in results if r[2] < 0.7]
        failure_analysis = analyze_failures(failures)

        # 5. 让 LLM 基于分析改进 prompt
        improvement_prompt = f"""
当前 prompt:
{current_prompt}

测试结果：平均分 {avg_score}

失败案例分析：
{failure_analysis}

请基于以上信息改进 prompt，解决发现的问题。
"""
        current_prompt = llm(improvement_prompt)

    return current_prompt, avg_score
```

这个循环把「写 prompt → 测试 → 分析 → 改进」的完整流程自动化了。人类只需要做两件事：定义任务和提供测试用例。

### 12.3 自动 Few-Shot 示例选择

Few-shot prompting 的效果高度依赖示例的选择。循环可以自动挑选最优示例：

```python
def select_best_examples(candidate_pool, target_task, k=3):
    """从候选池中自动选择最优的 k 个示例"""

    best_examples = []
    best_score = 0

    # 贪心选择：逐个添加示例，每次选提升最大的
    for i in range(k):
        best_candidate = None
        best_marginal_gain = 0

        for candidate in candidate_pool:
            if candidate in best_examples:
                continue

            # 测试添加这个示例后的效果
            test_examples = best_examples + [candidate]
            prompt = build_few_shot_prompt(test_examples, target_task)
            score = evaluate_prompt(prompt, target_task.test_set)

            marginal_gain = score - best_score
            if marginal_gain > best_marginal_gain:
                best_marginal_gain = marginal_gain
                best_candidate = candidate

        if best_candidate:
            best_examples.append(best_candidate)
            best_score += best_marginal_gain
            print(f"选择示例 {i+1}: {best_candidate.id}, "
                  f"边际增益 {best_marginal_gain:.2f}")

    return best_examples
```

这个循环的本质是**贪心搜索**——每一步选择带来最大边际增益的示例。虽然不一定全局最优，但远比人工挑选高效。

更高级的做法是用**遗传算法**：把示例组合看作「个体」，通过交叉、变异、选择来进化出最优的示例集合。

### 12.4 Chain-of-Thought 的自动构建

Chain-of-Thought (CoT) prompting 要求提供推理步骤的示例。手动编写这些推理链很繁琐，循环可以自动生成：

```python
def auto_cot_construction(problems, solutions):
    """自动构建 CoT 示例"""

    cot_examples = []

    for problem, solution in zip(problems, solutions):
        # 让 LLM 生成推理过程
        reasoning_prompt = f"""
问题：{problem}
答案：{solution}

请一步步展示如何从问题推导出答案。
要求：
1. 每一步推理都要清晰
2. 标注关键的中间结果
3. 解释为什么采取这个推理方向
"""
        reasoning = llm(reasoning_prompt)

        # 验证推理链的正确性
        verification = verify_reasoning(problem, reasoning, solution)

        if verification.is_valid:
            cot_examples.append({
                "problem": problem,
                "reasoning": reasoning,
                "solution": solution
            })

    return cot_examples
```

这里有两个循环：**外层循环**遍历多个问题，**内层循环**（在 `verify_reasoning` 中）验证推理链的每一步是否正确。如果某一步出错，可以触发修复循环。

### 12.5 Prompt 的进化与变异

借鉴遗传算法的思路，可以通过「变异」和「选择」来进化 prompt：

```python
def prompt_evolution(initial_prompt, test_set, generations=5, population_size=10):
    """通过进化策略优化 prompt"""

    # 初始种群
    population = [initial_prompt]
    for _ in range(population_size - 1):
        population.append(mutate_prompt(initial_prompt))

    for gen in range(generations):
        # 评估适应度
        fitness = []
        for prompt in population:
            score = evaluate_prompt(prompt, test_set)
            fitness.append((prompt, score))

        # 排序，选择 top-K
        fitness.sort(key=lambda x: x[1], reverse=True)
        top_k = fitness[:population_size // 2]

        print(f"Generation {gen}: 最高分 {top_k[0][1]:.2f}, "
              f"平均分 {sum(f[1] for f in fitness)/len(fitness):.2f}")

        # 生成下一代
        next_generation = [f[0] for f in top_k]  # 保留精英

        # 交叉和变异
        while len(next_generation) < population_size:
            parent1, parent2 = random.sample(top_k, 2)
            child = crossover_prompts(parent1[0], parent2[0])
            child = mutate_prompt(child)
            next_generation.append(child)

        population = next_generation

    # 返回最优个体
    return max(population, key=lambda p: evaluate_prompt(p, test_set))
```

变异操作可以包括：
- **措辞替换**：同义词、近义表达
- **结构调整**：改变段落顺序、添加/删除小节
- **示例增删**：添加新的 few-shot 示例、移除效果差的示例
- **指令细化**：把模糊的指令变得更具体，或把过于具体的指令泛化

### 12.6 人机协作：循环的边界

循环可以自动化 prompt 工程的很大一部分，但不是全部。有些工作仍然需要人类：

**任务定义。** 「什么是一个好的 prompt」取决于任务目标。目标本身需要人类定义——是追求准确率、创造性、还是安全性？

**测试用例设计。** 自动优化需要测试集。设计覆盖边界情况、反映真实需求的测试用例，需要领域专业知识。

**价值判断。** 当多个 prompt 得分相近时，选择哪个涉及主观偏好（风格、可读性、维护性）。

**创意突破。** 循环擅长在已有框架内优化，但跳出框架的创新（比如发明全新的 prompting 技巧）仍然依赖人类创造力。

**伦理审查。** 自动优化的 prompt 可能在测试集上表现很好，但在更广泛的场景中产生偏见或有害输出。人类需要审查和把关。

```text
人类的角色：
├── 定义任务目标和质量标准
├── 设计测试集和评估指标
├── 审查最终 prompt 的安全性和公平性
└── 在关键决策点做出判断

循环的角色：
├── 生成初始 prompt
├── 测试和评估
├── 分析失败案例
├── 迭代改进
└── 搜索最优配置
```

一个高效的 Prompt Engineering 流程，应该是**人类设定方向和边界，循环在边界内自动优化**。人类负责「做什么」，循环负责「怎么做」。

## 结语

Loop Engineering 的核心洞察是：**智能不是单次推理的产物，而是迭代过程的涌现。**

一个只做一次推理的 LLM，和一个会循环迭代的 Agent，能力差距可能是质的飞跃。循环让 Agent 能够纠错、学习、规划、协作——这些都不是一次性计算能做到的。

但循环也是最容易出问题的地方。无限循环、成本失控、上下文溢出、调试困难——每一个都是真实的工程挑战。好的 Loop Engineering 不只是设计循环逻辑，更是设计循环的边界：什么时候该循环、什么时候该停止、什么时候该求助。

从 ReAct 的基础循环，到 Reflexion 的反思循环，到 Tree of Thoughts 的搜索循环，再到多 Agent 的协作循环——每一步演进都在回答同一个问题：**如何让机器像人一样，从尝试中学习，从失败中成长？**

这个问题没有终极答案。但每解决一小步，Agent 就离「真正有用」更近一步。

值得注意的是，2024-2025 年间出现了一批将循环能力「内化」到模型本身的突破。OpenAI 的 **o1/o3** 推理模型和 DeepSeek 的 **DeepSeek-R1**（2025）展示了模型在回答之前进行长时间内部推理（chain-of-thought）的能力，包括自我修正、回溯验证和策略切换——这些原本需要外部 Harness 实现的循环行为，开始出现在模型权重中。Wang 等人（2026）在 **Agent Cybernetics** 中进一步提出，应该用控制论的理论框架来系统化地分析和设计 Agent 的循环行为，而不是继续依赖试错。这些方向暗示着 Loop Engineering 的未来：循环逻辑可能从外部脚手架逐步迁移到模型内部，而 Harness 的角色从「驱动循环」变成「监督循环」。

## 参考文献

Yao, S., Zhao, J., Yu, D., et al. (2023). *ReAct: Synergizing Reasoning and Acting in Language Models*. ICLR 2023. https://arxiv.org/abs/2210.03629

Shinn, N., Cassano, F., Gopinath, A., et al. (2023). *Reflexion: Language Agents with Verbal Reinforcement Learning*. NeurIPS 2023. https://arxiv.org/abs/2303.11366

Yao, S., Yu, D., Zhao, J., et al. (2023). *Tree of Thoughts: Deliberate Problem Solving with Large Language Models*. NeurIPS 2023. https://arxiv.org/abs/2305.10601

Lightman, H., Kosaraju, V., Burda, Y., et al. (2024). *Let's Verify Step by Step*. ICLR 2024. https://arxiv.org/abs/2305.20050

OpenAI. (2024). *Introducing OpenAI o1*. https://openai.com/index/introducing-openai-o1-preview/

OpenAI. (2025). *Introducing o3 and o4-mini*. https://openai.com/index/introducing-o3-and-o4-mini/

DeepSeek-AI. (2025). *DeepSeek-R1: Incentivizing Reasoning Capability in LLMs via Reinforcement Learning*. https://arxiv.org/abs/2501.12948

Wang, X., Yang, C., Zhao, H., et al. (2026). *The Agent Use of Agent Beings: Agent Cybernetics Is the Missing Science of Foundation Agents*. https://arxiv.org/abs/2605.10754

Wu, Q., Yen, G., Liu, X., et al. (2023). *AutoGen: Enabling Next-Gen LLM Applications via Multi-Agent Conversation*. https://arxiv.org/abs/2308.08155
