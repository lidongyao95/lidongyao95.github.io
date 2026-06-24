---
title: 'Loop Engineering：让 AI Agent 学会「转圈」的艺术'
date: 2026-06-23
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

## 8. 循环模式的选择

### 8.1 按任务类型选择

| 任务类型 | 推荐循环模式 | 理由 |
|----------|-------------|------|
| 代码生成/修复 | 生成-检查-修复 | 有客观验证信号（测试） |
| 信息检索 | ReAct | 需要多步搜索和综合 |
| 复杂推理 | Tree of Thoughts | 需要探索多条路径 |
| 长期任务 | Plan-Execute-Reflect | 需要全局规划和动态调整 |
| 代码审查 | 多 Agent 对话循环 | 需要不同视角的交叉验证 |
| 学习类任务 | Reflexion | 需要从失败中积累经验 |

### 8.2 按复杂度选择

**简单任务（1-2 步）。** 不需要循环，直接执行。

**中等任务（3-5 步）。** ReAct 循环，配合生成-检查-修复。

**复杂任务（5+ 步）。** Plan-Execute-Reflect，配合动态重规划。

**非常复杂的任务。** 多 Agent 协作 + 层级循环。

### 8.3 组合使用

实际系统中，多种循环模式经常组合使用：

```text
外层: Plan-Execute-Reflect（全局规划）
  └── 中层: ReAct（每个子任务的执行）
       └── 内层: Generate-Verify-Fix（代码生成的验证循环）
```

## 结语

Loop Engineering 的核心洞察是：**智能不是单次推理的产物，而是迭代过程的涌现。**

一个只做一次推理的 LLM，和一个会循环迭代的 Agent，能力差距可能是质的飞跃。循环让 Agent 能够纠错、学习、规划、协作——这些都不是一次性计算能做到的。

但循环也是最容易出问题的地方。无限循环、成本失控、上下文溢出、调试困难——每一个都是真实的工程挑战。好的 Loop Engineering 不只是设计循环逻辑，更是设计循环的边界：什么时候该循环、什么时候该停止、什么时候该求助。

从 ReAct 的基础循环，到 Reflexion 的反思循环，到 Tree of Thoughts 的搜索循环，再到多 Agent 的协作循环——每一步演进都在回答同一个问题：**如何让机器像人一样，从尝试中学习，从失败中成长？**

这个问题没有终极答案。但每解决一小步，Agent 就离「真正有用」更近一步。

## 参考文献

Yao, S., Zhao, J., Yu, D., et al. (2023). *ReAct: Synergizing Reasoning and Acting in Language Models*. ICLR 2023.

Shinn, N., Cassano, F., Gopinath, A., et al. (2023). *Reflexion: Language Agents with Verbal Reinforcement Learning*. NeurIPS 2023.

Yao, S., Yu, D., Zhao, J., et al. (2023). *Tree of Thoughts: Deliberate Problem Solving with Large Language Models*. NeurIPS 2023.

Wu, Q., Yen, G., Liu, X., et al. (2023). *AutoGen: Enabling Next-Gen LLM Applications via Multi-Agent Conversation*.
