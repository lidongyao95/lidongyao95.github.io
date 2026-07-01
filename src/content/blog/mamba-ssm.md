---
title: 'Mamba 与 Mamba2：训练能并行，推理只需常数状态'
date: 2026-07-01
excerpt: '从 Transformer 的 KV Cache 瓶颈出发，推导 Mamba 的选择性状态空间与 Parallel Scan 训练，再深入 Mamba2 的状态空间对偶（SSD），揭示 SSM 与半可分矩阵的等价性。'
---

## 前言

假设你正在部署一个大语言模型的推理服务。用户发来一条消息，模型生成回复——很快。但随着对话越来越长，你注意到一个令人不安的趋势：GPU 显存在持续攀升，生成速度在逐渐下降。

罪魁祸首是 **KV Cache**。Transformer 的 Self-Attention 需要看到序列中所有位置的 Key 和 Value，所以推理时必须把历史 KV 全部存在显存里。对话越长，缓存越大。100K 上下文的对话，KV Cache 可以占到数十 GB。训练端也一样：Attention 的 $O(n^2)$ 复杂度让长序列训练成本高昂，即便 GPU 能并行处理，显存也吃不消。

这引出了一个自然的问题：**有没有一种架构，训练时可以高效并行，推理时只需要常数大小的状态？**

Mamba 和 Mamba2 就是对这个问题的回答。它们不是从 Attention 出发做改良，而是从一个完全不同的起点——**状态空间模型（State Space Model, SSM）**——走到了一个令人惊讶的终点：训练复杂度亚二次，推理状态 $O(d)$（与序列长度无关），而且在硬件效率上甚至超越了高度优化的 FlashAttention。

这篇文章会沿着两条线索展开。前半段看 Mamba1 如何在推理端用递推实现 $O(1)$ 状态、在训练端用 Parallel Scan 实现高效并行。后半段深入 Mamba2 的 **State Space Duality（SSD）**——一个优美的数学发现：SSM 递推本质上是一个**半可分矩阵乘法**，这个等价性不仅让训练更快，还揭示了 SSM 与 Linear Attention 的深层统一。

## 1. Transformer 的推理困境

### 1.1 KV Cache：推理的 O(n) 内存墙

Transformer 生成文本是自回归的：每一步生成一个 token，需要看到之前所有 token。Self-Attention 的计算是：

$$\text{Attention}(Q, K, V) = \text{softmax}\left(\frac{Q K^T}{\sqrt{d}}\right) V$$

其中 $K \in \mathbb{R}^{n \times d}$，$V \in \mathbb{R}^{n \times d}$ 是整个序列的 Key 和 Value 矩阵。

推理时，每生成一个新 token，我们需要它和**所有历史 token** 做 Attention。为了不重复计算，标准做法是把历史的 $K$、$V$ 缓存起来——这就是 KV Cache。

对于 $L$ 层 Transformer，每层有 $h$ 个注意力头，头维度 $d_h$，序列长度 $n$ 时：

$$\text{KV Cache 大小} = 2 \times L \times h \times d_h \times n \times \text{sizeof(float16)}$$

以 Llama-2 70B（$L=80$, $h=64$, $d_h=128$，无 GQA）为例：

$n = 8\text{K}$ 时：

$$2 \times 80 \times 64 \times 128 \times 8192 \times 2 \text{ bytes} \approx 21.5 \text{ GB}$$

已经不小了。当上下文增长到 $n = 128\text{K}$ 时，KV Cache 膨胀到约 **344 GB**——几乎占满 8×A100 80GB 的全部显存。即便使用 GQA（8 个 KV head），128K 的 KV Cache 仍有约 **43 GB**。如果同时服务多个用户，显存很快被吃光。这就是 Transformer 推理的核心瓶颈：状态大小与序列长度**线性增长**。

### 1.2 训练与推理的不对称

有趣的是，Transformer 在训练和推理时面对的是完全不同的挑战：

- **训练**：整个序列已知，$Q, K, V$ 可以一次性算出来，Attention 矩阵 $QK^T \in \mathbb{R}^{n \times n}$ 可以用 GPU 的矩阵乘法高效并行。代价是 $O(n^2 d)$ 的计算和 $O(n^2)$ 的显存，但**能并行**。
- **推理**：每步只来一个新 token，必须自回归地逐步生成。新 token 需要看到所有历史 KV，所以要么重算（太慢），要么缓存（太大）。状态 $O(nd)$，**不能并行**。

训练端的问题是 $O(n^2)$ 复杂度，推理端的问题是 $O(n)$ 状态。两边都需要突破。

```text
Transformer 的效率困境
═══════════════════════════════════════════════

  训练端                          推理端
  ─────────────                   ─────────────
  能并行？  ✓ 能（全序列已知）      ✗ 不能（自回归）
  复杂度？  O(n²d)                 O(n²d) 总计
  显存？    O(n²) Attention矩阵     O(nd) KV Cache
  瓶颈？    长序列显存爆炸          KV Cache 线性增长
```

我们想要的理想架构是：训练端**亚二次并行**，推理端**常数状态**。

## 2. Mamba1：选择性状态空间

### 2.1 SSM 连续形式

状态空间模型的出发点是连续时间的线性微分方程：

$$h'(t) = A h(t) + B(t) x(t)$$
$$y(t) = C(t) h(t)$$

$h(t) \in \mathbb{R}^N$ 是隐状态（$N$ 是状态维度，不是序列长度），$x(t) \in \mathbb{R}$ 是输入，$y(t) \in \mathbb{R}$ 是输出。$A \in \mathbb{R}^{N \times N}$ 控制状态演化，$B(t)$ 把输入注入状态，$C(t)$ 从状态中读出输出。

直觉上，$h(t)$ 是一个**压缩的历史摘要**。$A$ 决定旧信息如何衰减，$B(t)$ 决定新信息如何写入，$C(t)$ 决定哪些信息被读出。

### 2.2 离散化：从连续到可计算

神经网络处理离散序列，所以需要把连续 SSM 离散化。Mamba 使用**零阶保持（Zero-Order Hold, ZOH）**离散化，引入一个可学习的步长 $\Delta$：

$$\bar{A} = \exp(\Delta A)$$
$$\bar{B} = (\exp(\Delta A) - I) A^{-1} B \approx \Delta B$$

离散化后的递推形式：

$$h_t = \bar{A} h_{t-1} + \bar{B}_t x_t$$
$$y_t = C_t h_t$$

注意结构和 RNN 几乎一样——$h_t$ 依赖 $h_{t-1}$ 和 $x_t$。区别在于：RNN 的参数 $W_{hh}, W_{xh}$ 是通用矩阵，而 SSM 的 $\bar{A}$ 具有**结构化约束**（来自 $A$ 的指数映射），使得模型可以用卷积形式高效计算。

```text
Mamba SSM 递推
═══════════════════════════════════════════════

  x₁        x₂        x₃              x_n
   │         │         │               │
   ▼         ▼         ▼               ▼
 [B₁·x₁]  [B₂·x₂]  [B₃·x₃]        [B_n·x_n]
   │         │         │               │
   ▼         ▼         ▼               ▼
 ┌───┐     ┌───┐     ┌───┐           ┌───┐
 │ + │────▶│ + │────▶│ + │── ··· ──▶│ + │
 └─┬─┘     └─┬─┘     └─┬─┘           └─┬─┘
   │         │         │               │
   ▼         ▼         ▼               ▼
   h₁        h₂        h₃              h_n
   │         │         │               │
   ▼         ▼         ▼               ▼
  y₁=C₁h₁  y₂=C₂h₂  y₃=C₃h₃        y_n=C_n h_n

  每步：h_t = Ā · h_{t-1} + B̄_t · x_t
  每步：y_t = C_t · h_t
```

### 2.3 选择性机制：让 SSM 依赖输入

**这是 Mamba1 最核心的贡献。**

在 Mamba 之前的 SSM（如 S4）中，$A, B, C, \Delta$ 都是**固定的**——不依赖输入。这意味着模型对所有输入一视同仁：不管内容是什么，信息的写入和读取方式都一样。

> 📄 **Efficiently Modeling Long Sequences with Structured State Spaces (S4)**
> Albert Gu, Karan Goel, Christopher Ré. ICLR 2022.
> 提出 S4，用 HiPPO 初始化对角矩阵 $A$，首次在 SSM 框架下高效建模超长序列。

Mamba 的关键改变是让 $B$、$C$、$\Delta$ 都成为**输入的函数**：

$$B_t = \text{Linear}_B(x_t), \quad C_t = \text{Linear}_C(x_t), \quad \Delta_t = \text{softplus}(\text{Linear}_\Delta(x_t))$$

$A$ 仍然固定（因为需要对角化以高效计算指数）。

这意味着模型可以**根据输入内容**选择性地：

- **写入**（$B_t$ 控制）：看到重要信息时加大注入
- **衰减**（$\Delta_t$ 控制）：$\Delta_t$ 大则更多关注当前输入，$\Delta_t$ 小则更多保留旧状态
- **读出**（$C_t$ 控制）：只在需要时从状态中取出相关信息

直觉上，$\Delta_t$ 就是一个"注意力开关"：

$$h_t = \underbrace{\exp(\Delta_t A)}_{\text{旧状态衰减}} h_{t-1} + \underbrace{\bar{B}_t}_{\approx \Delta_t B} x_t$$

$\Delta_t$ 大 $\implies$ $\exp(\Delta_t A)$ 衰减更多（旧信息被冲淡），$\bar{B}_t$ 增大（新信息被写入）——模型"注意到了"当前输入。

$\Delta_t$ 小 $\implies$ $\exp(\Delta_t A) \approx I$（旧信息保留），$\bar{B}_t \approx 0$（新信息被忽略）——模型"跳过了"当前输入。

这和 LSTM 的遗忘门在概念上异曲同工——都是学习"记住什么、忘记什么"。如果你对 LSTM 的门控机制感兴趣，可以参考[这篇文章](/blog/rnn-lstm-gru)中关于梯度流的详细分析。

> 📄 **Mamba: Linear-Time Sequence Modeling with Selective State Spaces**
> Albert Gu, Tri Dao. arXiv 2023.
> 提出选择性机制，让 SSM 的参数依赖输入，首次使 SSM 在语言建模任务上匹配 Transformer。

### 2.4 推理：O(1) 状态

有了递推形式，Mamba 的推理极其简洁：

**每生成一个新 token $x_t$，只需要维护一个状态向量 $h_{t-1} \in \mathbb{R}^N$**：

$$h_t = \bar{A}_t h_{t-1} + \bar{B}_t x_t$$
$$y_t = C_t h_t$$

然后丢弃 $h_{t-1}$，保留 $h_t$。

状态大小始终是一个 $N$ 维向量，**与序列长度无关**。对比 Transformer 的 KV Cache 随 $n$ 线性增长，Mamba 的推理状态是真正的 $O(1)$。

对于 128K 的上下文，Transformer（无 GQA）需要约 344 GB 的 KV Cache，而 Mamba 只需要存储一个状态向量——通常是几 MB 量级。

## 3. 训练端突破：Parallel Scan

### 3.1 序列递推如何并行化

推理用递推很好，但训练时我们需要**整个序列**的输出 $y_1, y_2, \ldots, y_n$。如果只能用递推一步步算，训练就是 $O(n)$ 串行的——比 Transformer 的 $O(n^2)$ 但高度并行还慢。

解决方案是 **Parallel Scan**（也叫 Prefix Scan）。

核心观察：Mamba 的递推是一个**仿射变换**：

$$h_t = \bar{A}_t h_{t-1} + \bar{B}_t x_t$$

可以写成 $(h_t, 1)$ 的矩阵形式：

$$\begin{pmatrix} h_t \\ 1 \end{pmatrix} = \underbrace{\begin{pmatrix} \bar{A}_t & \bar{B}_t x_t \\ 0 & 1 \end{pmatrix}}_{M_t} \begin{pmatrix} h_{t-1} \\ 1 \end{pmatrix}$$

那么：

$$\begin{pmatrix} h_n \\ 1 \end{pmatrix} = M_n \cdot M_{n-1} \cdots M_1 \begin{pmatrix} h_0 \\ 1 \end{pmatrix}$$

因为**矩阵乘法满足结合律**，我们可以用 Parallel Scan 计算所有前缀积：

$$P_k = M_k \cdot M_{k-1} \cdots M_1, \quad k = 1, 2, \ldots, n$$

```text
Parallel Scan：从 O(n) 串行到 O(log n) 并行
═══════════════════════════════════════════════

  串行递推（O(n) 步）：
  M₁ → M₂ → M₃ → M₄ → M₅ → M₆ → M₇ → M₈

  并行扫描（O(log n) 层）：

  第1层（两两合并）：
  M₁  M₂  M₃  M₄  M₅  M₆  M₇  M₈
   │   │   │   │   │   │   │   │
   └─┬─┘   └─┬─┘   └─┬─┘   └─┬─┘
  M₁₂     M₃₄     M₅₆     M₇₈

  第2层（四四合并）：
     M₁₂       M₃₄       M₅₆       M₇₈
      │         │         │         │
      └────┬────┘         └────┬────┘
         M₁₄                M₅₈

  第3层（八八合并）：
            M₁₄                     M₅₈
             │                       │
             └──────────┬────────────┘
                      M₁₈

  总工作 O(n)，深度 O(log n)，完美适配 GPU 并行
```

Parallel Scan 的总计算量是 $O(n)$，但**深度**只有 $O(\log n)$——在 GPU 上 $O(n)$ 的工作可以并行完成。训练时间从串行的 $O(n)$ 降到并行的 $O(\log n)$。

对比 Attention 的 $O(n^2 d)$ 训练复杂度，Mamba 的训练复杂度是 $O(n \log n \cdot N^2)$（其中 $N$ 是状态维度，$N \ll d$）。对于长序列，这有显著优势。

### 3.2 IO-Aware 硬件感知

计算量不是全部——GPU 上的实际速度还取决于**内存访问效率**。

GPU 有两层存储：**HBM**（高带宽内存，容量大但慢）和 **SRAM**（片上缓存，极快但小）。Parallel Scan 需要计算中间状态 $h_1, h_2, \ldots, h_n$，如果全部写回 HBM，内存 IO 是 $O(n \cdot N)$——和 Attention 写回 $O(n^2)$ 的 Attention 矩阵一样，会成为瓶颈。

Mamba 的解决方案是**不物化中间状态**。通过自定义 CUDA kernel，整个 Parallel Scan 在 SRAM 中完成，只把最终结果 $y_1, \ldots, y_n$ 写回 HBM。

这使得 Mamba 的实际 IO 复杂度从 $O(nN)$ 降到 $O(n)$（只需要读写输入和输出），**在相同 FLOP 下比标准实现快数倍**。

> 📄 **FlashAttention: Fast and Memory-Efficient Exact Attention with IO-Awareness**
> Tri Dao, Daniel Y. Fu, Stefano Ermon, Atri Rudra, Christopher Ré. NeurIPS 2022.
> 同样的 IO-aware 思想用在 Attention 上：不在 HBM 中物化 $n \times n$ 的 Attention 矩阵，而是分块在 SRAM 中计算。

## 4. Mamba2：状态空间对偶

Mamba1 解决了"推理 $O(1)$ 状态"和"训练 $O(n \log n)$ 并行"的问题。但在实践中，Parallel Scan 的 GPU 利用率不如矩阵乘法高——Scan 操作的并行度有限，不能充分利用 GPU 的 Tensor Core。

2024 年，Dao 和 Gu 提出了 **Mamba2**，核心发现是一个优美的数学等价性：**SSM 递推等价于一个半可分矩阵乘法**。这个发现让训练可以直接用高效的矩阵乘法完成。

### 4.1 SSD 核心思想

回顾 Mamba 的递推：

$$h_t = \bar{A}_t h_{t-1} + \bar{B}_t x_t, \quad y_t = C_t h_t$$

展开来看：

$$y_1 = C_1 (\bar{B}_1 x_1)$$
$$y_2 = C_2 (\bar{A}_2 \bar{B}_1 x_1 + \bar{B}_2 x_2)$$
$$y_3 = C_3 (\bar{A}_3 \bar{A}_2 \bar{B}_1 x_1 + \bar{A}_3 \bar{B}_2 x_2 + \bar{B}_3 x_3)$$

把 $y = (y_1, y_2, \ldots, y_n)^T$ 写成矩阵形式 $y = M x$：

$$M = \begin{pmatrix} C_1 \bar{B}_1 & 0 & 0 & \cdots \\ C_2 \bar{A}_2 \bar{B}_1 & C_2 \bar{B}_2 & 0 & \cdots \\ C_3 \bar{A}_3 \bar{A}_2 \bar{B}_1 & C_3 \bar{A}_3 \bar{B}_2 & C_3 \bar{B}_3 & \cdots \\ \vdots & \vdots & \vdots & \ddots \end{pmatrix}$$

$M$ 是一个**下三角矩阵**——每个 $y_t$ 只依赖 $x_1, \ldots, x_t$，因果性自然满足。

更关键的是，$M$ 的每一个元素 $M_{ij}$（$i \geq j$）都可以写成：

$$M_{ij} = C_i \left(\prod_{k=j+1}^{i} \bar{A}_k \right) \bar{B}_j$$

这是一个**半可分矩阵（semiseparable matrix）**——下三角部分的秩结构可以被紧凑地分解。

> 📄 **Transformers are SSMs: Generalized Models and Efficient Algorithms Through Structured State Space Duality**
> Tri Dao, Albert Gu. ICML 2024.
> 证明 SSM 递推与半可分矩阵乘法的等价性，提出 SSD 算法，使 Mamba 训练速度提升 2-3 倍。

### 4.2 半可分矩阵的分解

半可分矩阵 $M$ 可以分解为：

$$M = (I + L)^{-1} D$$

其中：

- $D = \text{diag}(C_1 \bar{B}_1, C_2 \bar{B}_2, \ldots, C_n \bar{B}_n)$ 是对角矩阵（每个位置独立的"读写"）
- $L$ 是严格下三角矩阵，编码状态衰减的传播：

$$L_{ij} = \begin{cases} -C_i \bar{A}_i \bar{B}_{i-1} & \text{if } j = i-1 \\ 0 & \text{otherwise（简化形式）} \end{cases}$$

（完整的 $L$ 涉及更一般的低秩结构，这里展示最直观的带状形式。）

**这个分解的计算意义：**

$y = Mx = (I + L)^{-1} D x$

1. 先算 $z = Dx$（对角矩阵乘法，$O(n)$）
2. 再解 $(I + L) y = z$

第二步是一个**下三角系统的求解**。由于 $L$ 的结构，这个求解等价于一个线性递推——而线性递推可以用 Parallel Scan 高效并行化。

但关键改进在于：Mamba2 不是对整个序列做 Scan，而是把序列分成大小为 $B$ 的**块**：

```text
Mamba2 分块计算
═══════════════════════════════════════════════

  序列 x = [x₁, x₂, ..., x_n]
  分成块：[x₁..x_B] [x_{B+1}..x_{2B}] ··· [x_{n-B+1}..x_n]

  每块内部：
  ┌───────────────────────────┐
  │ 块内用矩阵乘法（Tensor Core）│
  │ 利用半可分结构的低秩性质    │
  │ 块大小 B ≈ 64-256          │
  └───────────────────────────┘

  块间传播：
  ┌───────────────────────────┐
  │ 块边界状态用 Scan 传播      │
  │ 只需 O(n/B) 次 Scan 操作    │
  │ Scan 维度远小于序列长度      │
  └───────────────────────────┘
```

**块内**：半可分矩阵的低秩结构使得块内的计算可以转化为标准矩阵乘法——这正好是 GPU Tensor Core 最擅长的操作。

**块间**：只需要传播 $n/B$ 个块边界状态，Scan 操作量大大减少。

结果：Mamba2 的训练速度比 Mamba1 快 **2-3 倍**，在某些序列长度上甚至超过 FlashAttention 优化后的 Transformer。

### 4.3 与 Gated Linear Attention 的统一视角

SSD 的发现带来了一个意外的副产品：它揭示了 Mamba 和 **Gated Linear Attention（GLA）** 的深层等价性。

GLA 的递推形式是：

$$S_t = G_t \odot S_{t-1} + k_t v_t^T$$
$$y_t = S_t q_t$$

其中 $S_t$ 是一个 $d \times d$ 的"状态矩阵"，$G_t$ 是逐元素衰减门，$k_t, v_t, q_t$ 分别类比于 Key、Value、Query。

对比 Mamba 的递推：

$$h_t = \bar{A}_t h_{t-1} + \bar{B}_t x_t$$
$$y_t = C_t h_t$$

如果把 $\bar{A}_t$ 看作衰减门 $G_t$，$\bar{B}_t x_t$ 看作写入项 $k_t v_t^T$，$C_t$ 看作读出 $q_t$——**两者在结构上完全同构**。

这意味着：

- Mamba 的 SSM 递推 $\iff$ GLA 的门控线性递推 $\iff$ 半可分矩阵乘法
- 三者在数学上描述的是同一件事

在[从 RNN 到 Linear Attention](/blog/rnn-to-linear-attention) 中，我们推导过"Linear Attention 本质上是一个 RNN"。现在这个链条进一步延伸了：

```text
统一框架
═══════════════════════════════════════════════

  Linear Attention
        ↕  等价（Katharopoulos 2020）
  线性 RNN
        ↕  加衰减门
  Gated Linear Attention (GLA)
        ↕  等价（SSD, Dao & Gu 2024）
  选择性 SSM (Mamba)
        ↕  矩阵视角
  半可分矩阵乘法
```

从不同的出发点——Attention、RNN、SSM、矩阵分解——我们到达了同一个数学对象。这不是巧合，而是序列建模的**基础结构**在不同视角下的投影。

## 5. 对比：训练效率与推理效率

### 5.1 核心指标对比

把 Transformer、Mamba1、Mamba2 放在一起，核心差异一目了然：

| 指标 | Transformer | Mamba1 | Mamba2 |
|------|------------|--------|--------|
| 训练复杂度 | $O(n^2 d)$ | $O(n \log n \cdot N^2)$ | $O(n \cdot B \cdot d)$ |
| 训练并行度 | 高（matmul） | 中（scan） | 高（matmul + scan） |
| 推理状态 | $O(nd)$ KV Cache | $O(N)$ 递推 | $O(N)$ 递推 |
| 推理每步计算 | $O(nd)$ | $O(N)$ | $O(N)$ |
| 硬件效率 | 高（Tensor Core） | 中（自定义 kernel） | 高（Tensor Core） |
| 长序列优势 | 弱（$n^2$ 爆炸） | 强 | 强 |

注：$n$ 为序列长度，$d$ 为模型维度，$N$ 为 SSM 状态维度（$N \ll d$），$B$ 为块大小。

### 5.2 各自的适用场景

**Transformer 仍然擅长的场景：**

- 需要精确检索长距离信息（如大海捞针任务）
- 短中序列的高质量生成
- 需要灵活的条件计算（如 MoE 与 Attention 结合）

**Mamba 系列的优势场景：**

- **超长序列**：DNA 序列（数百万碱基对）、视频理解（数万帧）、长文档处理
- **高吞吐推理服务**：常数状态意味着可以同时服务更多用户
- **边缘部署**：推理内存需求极低，适合手机、嵌入式设备

**混合架构的趋势：**

实际应用中，纯 Mamba 和纯 Transformer 可能都不是最优解。像 Jamba（AI21 Labs）这样的混合架构——交替使用 Attention 层和 Mamba 层——在保持高质量的同时获得了 Mamba 的效率优势。未来更可能是混合体的天下。

## 结语

Mamba 的故事可以从两个层面来理解。

**技术层面**，它展示了一种巧妙的"两全其美"：用递推形式解决推理端的 $O(n)$ 状态问题，用 Parallel Scan（Mamba1）或分块矩阵乘法（Mamba2）解决训练端的并行化问题。再加上 IO-awareness 的硬件优化，Mamba 在实际吞吐量上甚至超越了高度优化的 FlashAttention。

**数学层面**，Mamba2 的 SSD 揭示了一个更深刻的洞察：SSM、Gated Linear Attention、半可分矩阵——这些看似来自不同领域的工具，实际上是同一个数学对象的三个面向。当你理解了这种统一性，很多"新架构"就不再是独立的发明，而是同一个结构在不同视角下的自然浮现。

Transformer 的 Self-Attention 用"全局图"来建模序列——每个位置直接看到所有其他位置。Mamba 用"压缩状态"来建模序列——所有历史信息被压进一个固定维度的向量。前者精确但昂贵，后者紧凑但有损。两种范式各有优劣，而未来的方向很可能是让模型自己学会何时用图、何时用状态。

## 参考文献

> 📄 **Efficiently Modeling Long Sequences with Structured State Spaces (S4)**
> Albert Gu, Karan Goel, Christopher Ré. ICLR 2022.
> 首次用结构化状态空间模型高效建模超长序列，为 Mamba 奠定基础。

> 📄 **Mamba: Linear-Time Sequence Modeling with Selective State Spaces**
> Albert Gu, Tri Dao. arXiv 2023. arxiv:2312.00752
> 提出选择性机制和 IO-aware 实现，使 SSM 在语言建模上匹配 Transformer。

> 📄 **Transformers are SSMs: Generalized Models and Efficient Algorithms Through Structured State Space Duality**
> Tri Dao, Albert Gu. ICML 2024. arxiv:2405.21060
> 证明 SSM 与半可分矩阵的等价性（SSD），提出 Mamba2，训练加速 2-3 倍。

> 📄 **Gated Linear Attention Transformers with Hardware-Efficient Training**
> Songlin Yang, Bailin Wang, Yikang Shen, Rameswar Panda, Yoon Kim. ICML 2024. arxiv:2312.06635
> 提出 GLA，一种带衰减门的线性注意力变体，后被 SSD 证明与 Mamba 等价。

> 📄 **FlashAttention: Fast and Memory-Efficient Exact Attention with IO-Awareness**
> Tri Dao et al. NeurIPS 2022.
> IO-aware 分块计算 Attention，不物化 $n \times n$ 矩阵，成为 Transformer 训练的标准优化。
