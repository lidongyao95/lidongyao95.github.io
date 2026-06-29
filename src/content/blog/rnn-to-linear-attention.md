---
title: '从 RNN 到 Linear Attention：一次完整的数学推导'
date: 2026-06-29
excerpt: '从标准 Attention 的 O(n²) 瓶颈出发，一步步推导出 Linear Attention 与 RNN 的等价性，并追踪这条思路如何催生了 RWKV、RetNet 等现代架构。'
---

## 前言

2017 年 Transformer 横空出世，Self-Attention 取代了 RNN，成为序列建模的核心机制。之后的故事你大概已经知道了：GPT、BERT、LLaMA……Attention 一统江湖，RNN 被扫进了历史教科书。

但如果你把 Transformer 里的 softmax 拿掉，会发生什么？

答案是——你会重新「发明」一个 RNN。不是比喻，不是近似，而是严格意义上的数学等价。这不是我的发现，2020 年 Katharopoulos 等人在 ICML 上发表了一篇论文，标题就直白得令人震惊：**Transformers are RNNs**。

这篇文章想做一件事：把这个推导过程从头到尾走一遍。不是给你看结论，而是带你走完每一步。读完之后你会理解，为什么 Linear Attention 天然就是一个 RNN，为什么这个观察在 2020 年才被发现，以及它如何催生了 RWKV、RetNet、Mamba 等一系列现代架构。

## 1. 两种范式：图书馆与笔记本

在开始推公式之前，先建立一个直觉。

Standard Attention 的工作方式，像一个**图书馆管理员**：你问她「法国的首都是哪里？」，她会同时扫描图书馆里所有的书，找到和这个问题最相关的段落，然后综合所有相关段落给出答案。她每次回答问题都要遍历整个图书馆——如果图书馆有一万本书，她就看一万本书。

RNN 的工作方式，像一个**边读边做笔记的人**：他从第一页读到最后一页，每读一段就更新自己的笔记。笔记里记的不是原文，而是经过压缩的要点。读完全书后，他翻开笔记来回答问题。笔记的大小是固定的，不管书有多厚。

这两种方式的根本区别在于：

```text
Standard Attention:  Q × 所有 K → 权重 → 加权求和 V    （全局扫描）
RNN:                 h_t = f(h_{t-1}, x_t)              （逐步积累）
```

前者的计算量和序列长度 $n$ 的平方成正比——图书馆越大，每次查询越慢。后者的计算量和 $n$ 线性相关——书再厚，每读一页的工作量是固定的。

现在的问题是：我们能不能让 Attention 也变成「做笔记」的方式？

## 2. Standard Attention 的瓶颈

### 2.1 公式回顾

Standard Attention 的核心公式是：

$$
\text{Attention}(Q, K, V) = \text{softmax}\!\left(\frac{QK^\top}{\sqrt{d}}\right) V
$$

在自回归（causal）场景下，位置 $i$ 只能看到位置 $1$ 到 $i$ 的信息。展开写成单个位置的输出：

$$
o_i = \frac{\sum_{j=1}^{i} \exp(q_i^\top k_j / \sqrt{d}) \cdot v_j}{\sum_{j=1}^{i} \exp(q_i^\top k_j / \sqrt{d})}
$$

其中 $q_i, k_j, v_j \in \mathbb{R}^d$ 分别是 query、key、value 向量。分母是归一化项，确保注意力权重加起来等于 1。

### 2.2 复杂度分析

计算一个位置 $i$ 的输出，需要和前面所有 $i$ 个 key 做点积——$O(id)$ 的工作量。遍历全部 $n$ 个位置，总计算量是 $O(n^2 d)$。

同时，在自回归生成（推理）时，每生成一个新 token，你都需要把之前所有 token 的 key 和 value 重新拿出来做计算。这就是所谓的 **KV Cache**：

```text
生成第 t 个 token 时：
  - 需要 k_1, k_2, ..., k_{t-1} 和 v_1, v_2, ..., v_{t-1}
  - 缓存大小：O(t · d)
  - 计算量：O(t · d)
```

序列越长，KV Cache 越大，计算越慢。对于一个 128K 上下文的模型，KV Cache 可能占用几十 GB 显存——这就是长上下文之所以昂贵的根本原因。

### 2.3 瓶颈在哪里

仔细观察 attention 的公式，瓶颈的根源在于 **softmax 核函数的不可分解性**。

$\exp(q_i^\top k_j / \sqrt{d})$ 这个值，无法写成 $f(q_i)$ 和 $g(k_j)$ 的简单乘积。指数函数把 $q$ 和 $k$ 耦合在了一起，你不得不为每一对 $(q_i, k_j)$ 单独计算一次。

如果我们能找到一个替代的相似度函数，使得：

$$
\text{sim}(q, k) = \phi(q)^\top \phi(k)
$$

其中 $\phi$ 是某个特征映射（feature map），那么 $q$ 和 $k$ 就被解耦了——这就是一切推导的起点。

## 3. 关键推导：线性化注意力

### 3.1 第一步：替换核函数

把 softmax 核替换为线性核。用 $\phi(\cdot)$ 表示特征映射，新的相似度函数是：

$$
\text{sim}(q_i, k_j) = \phi(q_i)^\top \phi(k_j)
$$

代入 causal attention 公式：

$$
o_i = \frac{\sum_{j=1}^{i} \phi(q_i)^\top \phi(k_j) \cdot v_j}{\sum_{j=1}^{i} \phi(q_i)^\top \phi(k_j)}
$$

这一步看起来只是一个小小的替换，但它打开了一扇关键的门——因为 $\phi(q_i)$ 和求和指标 $j$ 无关，可以把它**提出求和号**。

### 3.2 第二步：解耦 Query 和 Key

把 $\phi(q_i)$ 从求和里提出来：

$$
o_i = \frac{\phi(q_i)^\top \sum_{j=1}^{i} \phi(k_j) v_j^\top}{\phi(q_i)^\top \sum_{j=1}^{i} \phi(k_j)}
$$

现在，求和号里只剩下 $k_j$ 和 $v_j$，和 $q_i$ 完全没有关系了。这意味着——**求和的部分可以逐步积累**。

让我们定义两个递推量：

$$
S_i = \sum_{j=1}^{i} v_j \, \phi(k_j)^\top \in \mathbb{R}^{d \times d}
$$

$$
z_i = \sum_{j=1}^{i} \phi(k_j) \in \mathbb{R}^{d}
$$

那么输出可以简洁地写为：

$$
o_i = \frac{S_i \, \phi(q_i)}{z_i^\top \phi(q_i)}
$$

你可以把 $S_i$ 想象成一本**笔记本**：每读到一个新 token，就往笔记本里添加一条「key 和 value 的关联记录」。$z_i$ 则是归一化的统计量。查询时，用当前的 query 去「翻阅」这本笔记本就行了，不需要重新看所有的 key 和 value。

### 3.3 第三步：写成递推形式

$S_i$ 和 $z_i$ 天然满足递推关系：

$$
S_i = S_{i-1} + v_i \, \phi(k_i)^\top
$$

$$
z_i = z_{i-1} + \phi(k_i)
$$

初始条件 $S_0 = \mathbf{0}_{d \times d}$，$z_0 = \mathbf{0}_d$。

把它们合在一起，定义隐状态（hidden state）：

$$
\mathcal{H}_i = \{S_i, \, z_i\}
$$

那么整个计算过程变成了：

```text
初始化：S_0 = 0 (d×d),  z_0 = 0 (d)

对每个位置 i = 1, 2, ..., n：
  ① 更新隐状态：
     S_i = S_{i-1} + v_i · φ(k_i)ᵀ       ← d×d 矩阵加一次外积
     z_i = z_{i-1} + φ(k_i)                ← d 维向量加一次

  ② 计算输出：
     o_i = S_i · φ(q_i) / (z_iᵀ · φ(q_i))  ← 矩阵向量乘法 + 标量除法
```

**这就是一个 RNN。**

每一步的计算只依赖当前的输入 $(k_i, v_i, q_i)$ 和上一步的隐状态 $\mathcal{H}_{i-1}$。隐状态的大小是固定的：一个 $d \times d$ 矩阵加一个 $d$ 维向量，和序列长度 $n$ 完全无关。

### 3.4 维度的意义

让我们停下来看看各部分的维度在说什么：

| 量 | 维度 | 含义 |
|---|---|---|
| $\phi(k_j)$ | $d$ | key 的特征表示 |
| $v_j$ | $d$ | value 的原始信息 |
| $v_j \phi(k_j)^\top$ | $d \times d$ | key-value 的关联矩阵（外积） |
| $S_i$ | $d \times d$ | 所有历史关联的累积 |
| $S_i \, \phi(q_i)$ | $d$ | 用 query 从累积关联中检索 value |

$S_i$ 的第 $a$ 行第 $b$ 列的元素 $S_i[a,b]$ 表示：在所有历史位置中，「value 的第 $a$ 个维度」和「key 特征的第 $b$ 个维度」之间的累积关联。当 query 来查询时，$\phi(q_i)$ 的第 $b$ 个分量告诉 $S_i$：「请帮我检索和第 $b$ 个 key 特征相关的 value 信息」。

这就是 RNN 隐状态的含义——**一个 key-value 关联的记忆矩阵**。

## 4. 等价性定理

### 4.1 正式表述

把上面的推导总结成一个定理：

> **定理（Katharopoulos et al., 2020）.** 给定特征映射 $\phi: \mathbb{R}^d \to \mathbb{R}^d$，因果线性注意力（causal linear attention）
> $$o_i = \frac{\sum_{j=1}^{i} \phi(q_i)^\top \phi(k_j) \, v_j}{\sum_{j=1}^{i} \phi(q_i)^\top \phi(k_j)}$$
> 等价于一个以 $\mathcal{H}_i = \{S_i, z_i\}$ 为隐状态的循环神经网络，其中
> $$S_i = S_{i-1} + v_i \phi(k_i)^\top, \quad z_i = z_{i-1} + \phi(k_i)$$
> 输出为 $o_i = S_i \phi(q_i) / (z_i^\top \phi(q_i))$。

> 📄 **Transformers are RNNs: Fast Autoregressive Transformers with Linear Attention**
> Katharopoulos, Vyas, Pappas, Fleuret. ICML 2020.
> 首次严格证明了因果线性注意力与 RNN 的等价性，并提出了高效的线性注意力 Transformer 实现。

### 4.2 复杂度对比

| | Standard Attention | Linear Attention (RNN 形式) |
|---|---|---|
| 训练计算量 | $O(n^2 d)$ | $O(n d^2)$ |
| 推理计算量（每步） | $O(t \cdot d)$ | $O(d^2)$ |
| 推理缓存大小 | $O(t \cdot d)$ | $O(d^2)$ |

当序列长度 $n > d$ 时（对 LLM 来说几乎总是如此，$d$ 通常在 64-128 左右每个 head），Linear Attention 的计算量更小。更重要的是推理时的缓存：$O(d^2)$ 是常数，不随序列增长——这对长上下文场景至关重要。

### 4.3 一个关键细节：隐状态的可微性

你可能在担心：$S_i$ 是一个 $d \times d$ 矩阵，对于典型的 $d = 128$（per-head），这个矩阵有 16384 个元素。在训练时反向传播需要保存每一步的隐状态，总存储量是 $O(nd^2)$——和标准 attention 的 $O(n^2 d)$ 相比，当 $n > d$ 时确实更省，但梯度计算仍然需要 BPTT（Back-Propagation Through Time）。

这是经典 RNN 的老问题。但 Linear Attention 有一个 RNN 不具备的优势：**它可以并行计算**。下面会讲。

## 5. 核函数工程：用什么来替代 Softmax

Linear Attention 的推导很漂亮，但有一个现实问题：线性核 $\phi(q)^\top \phi(k)$ 的表达力远不如 softmax 核 $\exp(q^\top k / \sqrt{d})$。如果什么都不做，模型性能会断崖式下降。

核函数工程就是解决这个问题的——用有限维的特征映射去逼近 softmax 核。

### 5.1 经典方法：随机傅里叶特征（Random Fourier Features）

Rahimi & Recht (2007) 的经典结论：对于平移不变核（如 RBF 核），存在随机特征映射：

$$
\phi(x) = \sqrt{\frac{2}{D}} \begin{pmatrix} \cos(w_1^\top x + b_1) \\ \cos(w_2^\top x + b_2) \\ \vdots \\ \cos(w_D^\top x + b_D) \end{pmatrix}, \quad w_i \sim \mathcal{N}(0, I), \; b_i \sim U(0, 2\pi)
$$

使得 $\mathbb{E}[\phi(x)^\top \phi(y)] = k(x, y)$。

这个方法可以用到 attention 上，但有一个严重的问题：$\phi$ 的分量可能为负，导致注意力权重为负值。负的注意力在语义上说不通，在实践中会导致训练不稳定。

### 5.2 Performer 的 FAVOR+

Choromanski 等人在 2021 年的 **Performer** 论文中提出了一个更优雅的解法。

核心观察是 softmax 核可以写成：

$$
\exp(q^\top k) = \exp\!\left(\frac{\|q\|^2}{2}\right) \exp\!\left(\frac{\|k\|^2}{2}\right) \exp\!\left(-\frac{\|q - k\|^2}{2}\right)
$$

最后一项 $\exp(-\|q-k\|^2/2)$ 是 RBF 核。利用这个分解，Performer 构造了**正随机特征（Positive Random Features, PRF）**：

$$
\phi(x) = \frac{C}{\sqrt{m}} \exp\!\left(\frac{\|x\|^2}{2}\right) \begin{pmatrix} \exp(\omega_1^\top x) \\ \exp(\omega_2^\top x) \\ \vdots \\ \exp(\omega_m^\top x) \end{pmatrix}
$$

其中 $\omega_i \sim \mathcal{N}(0, I)$，$C$ 是归一化常数。

每个分量都是 $\exp(\omega_i^\top x) > 0$，因此 $\phi(x) > 0$ 恒成立。注意力权重永远非负，问题解决了。

> 📄 **Rethinking Attention with Performers**
> Choromanski, Likhosherstov, Dohan, Song, Gane, Sarlos, Hawkins, Whitelock, Szarvas, Luo, Weller. ICLR 2021.
> 提出了 FAVOR+ 机制，用正随机特征逼近 softmax 核，在保持 $O(n)$ 复杂度的同时接近标准 Transformer 的精度。

### 5.3 ELU 核：最简单的方法

Katharopoulos et al. (2020) 自己用的核函数更简单：

$$
\phi(x) = \text{elu}(x) + 1
$$

其中 $\text{elu}(x) = x$ 当 $x > 0$，$\text{elu}(x) = e^x - 1$ 当 $x \leq 0$。

$\phi(x) \geq 0$ 恒成立（$\text{elu}$ 的下界是 $-1$，加 1 后非负），计算极快，不需要随机采样。代价是对 softmax 的逼近质量不如 PRF，但在实践中效果已经足够好了。

### 5.4 不同核的对比

```text
                  表达力          稳定性          计算开销
Softmax 核        ██████████      ██████████      ████ (O(n²d))
─────────────────────────────────────────────────────────
PRF (Performer)   ████████        ████████        ████████ (需采样)
ELU+1             █████           ██████████      ██████████ (最快)
RFF               ██████          ████            ████████ (需采样)
```

没有免费的午餐。核函数的选择取决于你对精度、速度和稳定性的权衡。

## 6. 并行训练：分块计算的魔法

### 6.1 问题

RNN 形式的 Linear Attention 在推理时很高效——每步 $O(d^2)$。但训练时，我们需要对序列中每个位置都计算输出，如果逐步递推，$n$ 步的总计算量是 $O(nd^2)$。

这比标准 attention 的 $O(n^2 d)$ 好很多，但问题是：**递推是串行的**。GPU 的强大并行能力无用武之地。

能不能在训练时并行计算？

### 6.2 分块策略（Chunk-wise Parallel）

答案是肯定的。核心思想是把序列切成长度为 $B$ 的块，块内并行、块间递推。

```text
序列：[x_1, x_2, ..., x_n]

切分成长度为 B 的块：
Block 1: [x_1, ..., x_B]
Block 2: [x_{B+1}, ..., x_{2B}]
Block 3: [x_{2B+1}, ..., x_{3B}]
...
```

对于第 $m$ 个块中的任意位置 $i$（$i$ 在块内的局部索引是 $l$），输出可以分解成两部分：

$$
o_i = \underbrace{S_{(m-1)B} \, \phi(q_i)}_{\text{块间：来自之前所有块的贡献}} + \underbrace{\sum_{j=1}^{l} \phi(q_i)^\top \phi(k_j') \, v_j'}_{\text{块内：当前块内的局部 attention}}
$$

其中 $S_{(m-1)B}$ 是前 $m-1$ 个块累积的隐状态，$\{k_j', v_j'\}$ 是当前块内的 key 和 value。

- **块间部分**：只需要每个块结束时的 $S$，可以用并行前缀扫描（parallel prefix scan）在 $O(\log(n/B))$ 步内完成
- **块内部分**：每个块内部就是一个标准的小规模 Linear Attention，可以用矩阵乘法并行计算，$O(B^2 d)$

当 $B \approx \sqrt{n}$ 时，训练效率接近标准 attention 的并行度，同时保留了推理时 RNN 的高效性。

> 📄 **Gated Linear Attention: Scaling to 7B & Seamlessly Integration with Transformer**
> Zhang, Peng, Qin, Su, Lin. ICML 2023.
> 提出了 GLA 的分块并行训练方法，使 Linear Attention 类模型可以高效训练到数十亿参数规模。

### 6.3 这意味着什么

分块计算让我们获得了两个世界的最佳组合：

```text
            训练                推理
标准 Attention:  并行 O(n²d)       串行 O(t·d), KV Cache O(t·d)
Linear Attention: 分块并行 O(nd²)   串行 O(d²), 隐状态 O(d²)
              ↑ 接近同等并行度    ↑ 常数级缓存，不随长度增长
```

这正是 RWKV、RetNet 等模型能够兼顾训练效率和长上下文推理的根本原因。

## 7. 现代变体：从 Linear Attention 到新 RNN 家族

基础版 Linear Attention 有一个结构性缺陷：隐状态 $S_i = S_{i-1} + v_i \phi(k_i)^\top$ 只会**增加**信息，永远不会**遗忘**。随着序列变长，$S$ 中积累的信息越来越多，噪声也越来越多，信噪比不断下降。

这是经典 RNN 面临的同一个问题——LSTM 用遗忘门（forget gate）解决了它。那么 Linear Attention 也可以加上门控。

### 7.1 门控衰减（Gated Decay）

在递推中引入衰减因子 $\gamma_i$：

$$
S_i = \gamma_i \odot S_{i-1} + v_i \, \phi(k_i)^\top
$$

其中 $\gamma_i \in (0, 1)^d$ 是一个逐维度的衰减向量（$\odot$ 表示逐元素的广播衰减），可以依赖于当前输入。这样隐状态就能选择性地遗忘旧信息。

不同的现代架构，本质上是在这个框架下做了不同的设计选择：

### 7.2 RetNet：Retentive Network

Sun et al. (2023) 的 RetNet 使用了**位置感知的固定衰减**：

$$
\gamma_i = \gamma^{i} \quad (\gamma < 1 \text{ 是超参数})
$$

等价于给历史每个位置的信息乘一个指数衰减权重。越远的信息衰减越多，这和人类记忆的直觉一致。

RetNet 的一个巧妙设计是：衰减因子 $\gamma$ 可以按 head 设置不同的值，让不同的注意力头关注不同时间尺度的信息——有的头关注近期上下文，有的头保持长期记忆。

> 📄 **Retentive Network: A Successor to Transformer for Large Language Models**
> Sun, Dong, Huang, Wang, Qin, Zhang, Lin, Wang, Zhang, Wang, Wang, Sun. arXiv 2023.
> 提出 RetNet，用位置感知衰减的 Linear Attention 替代标准 Attention，实现了训练并行、推理 $O(1)$ 的统一。

### 7.3 RWKV：RNN with Attention-like Performance

Bo Peng 的 RWKV 项目可能是 Linear Attention 思路在开源社区中最成功的实践。RWKV 引入了两个关键创新：

**Time-mixing（时间混合）**：当前的 $q, k, v$ 不是直接来自输入，而是当前输入和前一步输入的混合：

$$
r_t = W_r \cdot (\mu_r \, x_t + (1 - \mu_r) \, x_{t-1})
$$

这让模型能够感知局部的时序模式。

**Channel-mixing（通道混合）**：一个额外的门控全连接层，类似 Transformer 中的 FFN，但带有 sigmoid 门控：

$$
o_t = \sigma(W_k \cdot x_t) \odot (W_v \cdot x_t)
$$

RWKV-v5（也叫 RWKV "Eagle"）和 v6（"Finch"）进一步引入了类似 GLA 的数据依赖衰减，使得遗忘机制更加灵活。

### 7.4 Mamba 与 State Space Models

Mamba (Gu & Dao, 2023) 从另一个方向到达了近似的目的地：**结构化状态空间模型（SSM）**。

SSM 的连续形式是：

$$
h'(t) = A \, h(t) + B(t) \, x(t), \quad y(t) = C(t) \, h(t)
$$

离散化后（零阶保持）变成：

$$
h_t = \bar{A} \, h_{t-1} + \bar{B}_t \, x_t, \quad y_t = C_t \, h_t
$$

这和 Linear Attention 的递推形式几乎一模一样。Mamba 的关键创新是让 $B, C$ 和离散化步长 $\Delta$ 都**依赖于输入**（selective mechanism），从而获得和 attention 相当的选择性注意力能力。

> 📄 **Mamba: Linear-Time Sequence Modeling with Selective State Spaces**
> Gu, Dao. arXiv 2023.
> 提出了选择性状态空间模型，在语言建模上达到 Transformer 水平，同时保持线性时间复杂度。

### 7.5 全景对比

```text
                    递推核心               衰减机制          并行训练
─────────────────────────────────────────────────────────────────────
Linear Attention    S += v·φ(k)ᵀ          无               分块并行
RetNet              S = γ·S + v·φ(k)ᵀ    固定指数衰减      分块并行
RWKV-v5/6           S = γ_t·S + v·kᵀ    数据依赖衰减      分块并行
Mamba               h = Ā·h + B̄·x        选择性衰减       并行扫描
GLA                 S = γ_t·S + v·kᵀ    数据依赖衰减      分块并行
```

所有这些模型共享同一个底层结构：**带衰减的线性递推**。它们之间的差异，只是衰减方式和特征映射 $\phi$ 的选择不同。

从 RNN → Linear Attention → 门控 Linear Attention → Mamba，这条线索其实是一条连续的数学演化路径。

## 8. 实践代码：Linear Attention 的 RNN 前向传播

最后给一个最小可运行的 PyTorch 实现，把推导变成代码：

```python
import torch
import torch.nn.functional as F

def linear_attention_rnn(Q, K, V, phi=None):
    """
    Linear Attention 的 RNN 形式前向传播。
    Q, K, V: (batch, seq_len, d)
    phi: 特征映射函数，默认使用 elu + 1
    """
    if phi is None:
        phi = lambda x: F.elu(x) + 1

    B, n, d = Q.shape
    phi_Q, phi_K = phi(Q), phi(K)  # (B, n, d)

    S = torch.zeros(B, d, d, device=Q.device)  # 隐状态矩阵
    z = torch.zeros(B, d, device=Q.device)     # 归一化向量
    outputs = []

    for t in range(n):
        k_t = phi_K[:, t]   # (B, d)
        v_t = V[:, t]       # (B, d)
        q_t = phi_Q[:, t]   # (B, d)

        # ① 更新隐状态：S_t = S_{t-1} + v_t ⊗ k_t
        S = S + torch.bmm(v_t.unsqueeze(2), k_t.unsqueeze(1))  # (B, d, d)
        z = z + k_t  # (B, d)

        # ② 计算输出：o_t = S_t · q_t / (z_t · q_t)
        numerator = torch.bmm(S, q_t.unsqueeze(2)).squeeze(2)  # (B, d)
        denominator = torch.sum(z * q_t, dim=-1, keepdim=True)  # (B, 1)
        o_t = numerator / (denominator + 1e-6)

        outputs.append(o_t)

    return torch.stack(outputs, dim=1)  # (B, n, d)
```

这段代码和前面的推导一一对应：$S$ 就是那个 $d \times d$ 的记忆矩阵，$z$ 就是归一化向量，每一步先更新再查询。

你可以把它和标准 attention 做对比验证：

```python
def standard_causal_attention(Q, K, V):
    d = Q.shape[-1]
    scores = torch.matmul(Q, K.transpose(-2, -1)) / (d ** 0.5)
    mask = torch.triu(torch.ones_like(scores), diagonal=1).bool()
    scores.masked_fill_(mask, float('-inf'))
    attn = F.softmax(scores, dim=-1)
    return torch.matmul(attn, V)

# 验证
torch.manual_seed(42)
B, n, d = 2, 16, 32
Q, K, V = torch.randn(B, n, d), torch.randn(B, n, d), torch.randn(B, n, d)
out_standard = standard_causal_attention(Q, K, V)
out_linear = linear_attention_rnn(Q, K, V)
# 注意：两者不会完全相等（不同的核函数），但趋势和模式应该相似
```

## 结语

回过头看，从 RNN 到 Linear Attention 的推导其实只用了三步：替换核函数、解耦 query 和 key、把求和写成递推。每一步都简单到让人怀疑——为什么这个等价性直到 2020 年才被正式提出来？

一个可能的原因是**认知惯性**。Transformer 的成功太过耀眼，以至于研究者习惯性地把它和 RNN 看作两个截然不同的物种。Attention 是全局的、并行的；RNN 是局部的、串行的。这种二分法遮蔽了底层的数学统一性。

但正是这种统一性，打开了设计新架构的大门。当你理解了 Linear Attention 就是一个 RNN，你自然就会想到：给这个 RNN 加一个遗忘门？用数据依赖的衰减？换一种特征映射？RetNet、RWKV、Mamba、GLA——这些模型不是各自独立的发明，而是同一条思路的不同展开。

也许最有价值的启示不是任何一个具体的模型，而是这个推导过程本身传达的方法论：**当你看到一个 $O(n^2)$ 的计算时，问问自己——这个计算里有没有什么操作是满足结合律的？如果有，你就可以把它重写成递推。** 这个思路的威力远不止于 attention。

## 参考文献

> 📄 **Transformers are RNNs: Fast Autoregressive Transformers with Linear Attention**
> Katharopoulos, Vyas, Pappas, Fleuret. ICML 2020. [arxiv:2006.16236](https://arxiv.org/abs/2006.16236)
> 首次严格证明因果线性注意力与 RNN 的等价性，本文的核心推导来源。

> 📄 **Rethinking Attention with Performers**
> Choromanski, Likhosherstov, Dohan, Song, Gane, Sarlos, Hawkins, Whitelock, Szarvas, Luo, Weller. ICLR 2021. [arxiv:2009.14794](https://arxiv.org/abs/2009.14794)
> 提出 FAVOR+ 正随机特征机制，用有限维特征逼近 softmax 核。

> 📄 **Linear Transformers Are Secretly Fast Weight Programmers**
> Schlag, Irie, Schmidhuber. ICML 2021. [arxiv:2102.11174](https://arxiv.org/abs/2102.11174)
> 将线性 Transformer 解释为快速权重编程器，统一了 linear attention 和 fast weight 两个研究线索。

> 📄 **Gated Linear Attention: Scaling to 7B & Seamlessly Integration with Transformer**
> Zhang, Peng, Qin, Su, Lin. ICML 2023. [arxiv:2305.13928](https://arxiv.org/abs/2305.13928)
> 引入数据依赖门控的分块并行 Linear Attention，实现大规模训练。

> 📄 **Retentive Network: A Successor to Transformer for Large Language Models**
> Sun, Dong, Huang, Wang, Qin, Zhang, Lin, Wang, Zhang, Wang, Wang, Sun. arXiv 2023. [arxiv:2307.08621](https://arxiv.org/abs/2307.08621)
> 提出 RetNet，用位置感知衰减的 Linear Attention 统一训练并行和推理高效。

> 📄 **Mamba: Linear-Time Sequence Modeling with Selective State Spaces**
> Gu, Dao. arXiv 2023. [arxiv:2312.00752](https://arxiv.org/abs/2312.00752)
> 选择性状态空间模型，从 SSM 角度达到 Linear Attention 同等的序列建模能力。

> 📄 **Random Features for Large-Scale Kernel Machines**
> Rahimi, Recht. NeurIPS 2007. [PDF](https://people.eecs.berkeley.edu/~brecht/papers/07.rah.rec.nips.pdf)
> 随机傅里叶特征的原始论文，核函数逼近的理论基础。
