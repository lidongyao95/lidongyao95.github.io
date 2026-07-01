---
title: 'RNN、LSTM 与 GRU：一次关于梯度消失的完整推导'
date: 2026-07-01
excerpt: '从梯度流动的角度，理解 vanilla RNN 为何失败、LSTM 如何用门控机制解决问题、GRU 又如何简化设计。'
---

## 前言

假设你正在训练一个 RNN 来续写唐诗。输入"床前明月光"，模型输出"疑是地上霜"——还不错。但如果你给它一首长诗的前半段，让它预测后半段，它大概率会忘记开头的意象，开始胡言乱语。

这不是模型太小或数据不够。问题出在一个更基本的地方：**梯度在回传的过程中消失了**。

循环神经网络的核心想法极其简洁——用一个隐状态在时间步之间传递信息。但这个简洁的设计有一个致命缺陷：当梯度沿着时间反向传播时，它会反复乘以同一组参数。乘法看起来无害，但连续乘上几十次之后，梯度要么趋近于零（梯度消失），要么趋向无穷（梯度爆炸）。模型的参数更新信号根本传不到远处。

LSTM 和 GRU 就是为解决这个问题而生的。它们并不是"更复杂的 RNN"——它们是**为梯度修建了一条高速公路**的 RNN。

这篇文章会从 vanilla RNN 出发，一步步推导出梯度消失的数学原因，然后看 LSTM 怎样用门控机制绕开这个问题，最后看 GRU 如何进一步简化。前半段以直觉为主，后半段会切入严格的数学推导。读完之后，你会对"为什么需要门"这个问题有一个从直觉到公式的完整理解。

## 1. Vanilla RNN：最朴素的循环

### 1.1 一个公式概括一切

Vanilla RNN 的全部秘密就一个方程：

$$h_t = \tanh(W_{xh} \, x_t + W_{hh} \, h_{t-1} + b_h)$$

$x_t$ 是当前时刻的输入，$h_{t-1}$ 是上一时刻的隐状态，$h_t$ 是更新后的隐状态。$W_{xh}$ 把输入映射到隐空间，$W_{hh}$ 负责在隐状态之间传递信息，$\tanh$ 把值压到 $(-1, 1)$ 之间。

直觉上，隐状态就像一块"记忆黑板"：每一步擦掉旧内容、写上新内容。问题是，擦和写都由同一组参数 $W_{hh}$ 控制，而且每次都要过一遍 $\tanh$ 这个非线性压缩。

用一张图来展示信息流：

```text
Vanilla RNN 信息流
═══════════════════════════════════════════════

  x₁        x₂        x₃              x_T
   │         │         │               │
   ▼         ▼         ▼               ▼
 ┌────┐   ┌────┐   ┌────┐          ┌────┐
 │tanh│──▶│tanh│──▶│tanh│── ··· ──▶│tanh│
 └──┬─┘   └──┬─┘   └──┬─┘          └──┬─┘
    │         │         │               │
    └────W────┘────W────┘────W────···───┘
              hh              hh

  每一步：新状态 = tanh(W·旧状态 + U·输入)
  每一步都要经过 tanh 压缩 + W 线性变换
```

### 1.2 BPTT 与连乘诅咒

训练 RNN 的算法叫 **BPTT**（Backpropagation Through Time），本质就是把网络沿时间展开，然后做标准的反向传播。

假设损失函数是各时间步损失之和 $L = \sum_t L_t$。我们关心的是损失对某个早期隐状态 $h_k$ 的梯度——它决定了第 $k$ 步的参数更新幅度。

从时间步 $t$ 回传到 $k$（$t > k$），梯度要穿过中间的每一步：

$$\frac{\partial h_t}{\partial h_k} = \prod_{i=k+1}^{t} \frac{\partial h_i}{\partial h_{i-1}}$$

这是一个**连乘**。每一项 $\frac{\partial h_i}{\partial h_{i-1}}$ 是一个 $h \times h$ 的 Jacobian 矩阵，由两部分组成：

$$\frac{\partial h_i}{\partial h_{i-1}} = \text{diag}(\tanh'(z_i)) \cdot W_{hh}$$

其中 $z_i = W_{xh} x_i + W_{hh} h_{i-1} + b_h$ 是 $\tanh$ 的输入。

当 $t - k$ 很大时，你就是在把 $(t-k)$ 个这样的矩阵乘在一起。这就是问题的根源。

### 1.3 为什么连乘是致命的

先看 $\tanh$ 的导数：

$$\tanh'(z) = 1 - \tanh^2(z) \in (0, 1]$$

它**最大**是 1（在 $z = 0$ 时取到），其余时候严格小于 1。这意味着：

- 每个时间步，梯度至少被"压缩"了一点
- 连续乘上 $T$ 步，$\prod_{i=1}^{T} \tanh'(z_i)$ **指数级衰减**

再看 $W_{hh}$。如果它的谱范数（最大奇异值）$\|W_{hh}\| < 1$，那 $W_{hh}$ 本身也在压缩向量的长度。两者叠加：

$$\left\| \prod_{i=k+1}^{t} \text{diag}(\tanh'(z_i)) \cdot W_{hh} \right\| \leq \prod_{i=k+1}^{t} \|\tanh'(z_i)\| \cdot \|W_{hh}\| \to 0$$

梯度以指数速度趋近于零。第 100 步的损失信号几乎无法影响第 1 步的参数。模型学到的只是短期依赖。

反过来，如果 $\|W_{hh}\| > 1$，梯度可能指数级增长——**梯度爆炸**。爆炸至少还有信号，但信号大到让参数剧烈跳动，训练不稳定。实践中可以用梯度裁剪（gradient clipping）来缓解爆炸，但消失就没这么简单了——你没法把不存在的信号"放大"回来。

**传话游戏的类比。** 想象一个传话游戏：一句话经过 50 个人口口相传。每个人听完之后用自己的话复述（$\tanh$ 压缩），而且记忆不太可靠（$W_{hh}$ 变换）。传到第 50 个人时，原话已经面目全非。Vanilla RNN 的梯度传播就是这个过程——信息在每一步都被损耗，远处的信号传不回来。

> 📄 **On the difficulty of training recurrent neural networks**
> Yoshua Bengio, Patrice Simard, Paolo Frasconi. IEEE TNN 1994.
> 首次严格证明了 RNN 中梯度消失/爆炸的必然性，并指出这使得 RNN 难以学习长距离依赖。

## 2. LSTM：给记忆修一条高速公路

1997 年，Hochreiter 和 Schmidhuber 提出了一个关键洞察：梯度消失的根源是**每一步都经过非线性压缩**。如果我们能设计一条梯度传播路径，让它绕开 $\tanh$，不就行了？

### 2.1 核心直觉：Cell State 高速公路

LSTM 引入了一个新概念：**Cell State** $C_t$。

你可以把 Cell State 想象成一条"传送带"。信息可以几乎不经过任何变换地在传送带上流动。门（gate）的作用只是决定：往传送带上**放**什么东西、从传送带上**取**什么东西。但传送带本身，是一条近乎线性的通道。

这就是 LSTM 的核心设计：**把"存储"和"输出"分开**。Cell State 负责存储，隐状态 $h_t$ 只是 Cell State 的一个"过滤后的视图"。

```text
LSTM 信息流
══════════════════════════════════════════════════

  C₀ ──[f₁]──[+i₁·g₁]──[f₂]──[+i₂·g₂]── ··· ── C_T
         │      │         │      │
         │      │         │      │       Cell State 传送带
         │      │         │      │       (近乎线性)
         ▼      ▼         ▼      ▼
        h₁ ◀──[o₁·σ]    h₂ ◀──[o₂·σ]   隐状态 = 过滤后的视图

  梯度沿 Cell State 回传时：
  ∂C_t/∂C_{t-1} ≈ f_t   （只有逐元素乘法，不经过 tanh）
```

关键观察：Cell State 的更新是一个**加法**操作：

$$C_t = f_t \odot C_{t-1} + i_t \odot g_t$$

$f_t$（遗忘门）决定保留多少旧记忆，$i_t \odot g_t$（输入门 × 候选值）决定写入多少新信息。加法操作对梯度是**透明的**——梯度可以无损地穿过加法节点。而遗忘门 $f_t$ 是逐元素乘法，不是矩阵乘法，所以不存在 $W_{hh}$ 带来的额外压缩。

### 2.2 三个门：遗忘、输入、输出

LSTM 有三个门，每个门输出 $[0, 1]$ 之间的值，用 $\sigma$（sigmoid）激活：

**遗忘门** $f_t$：决定从 Cell State 中丢弃多少旧信息。

$$f_t = \sigma(W_f [h_{t-1}, x_t] + b_f)$$

**输入门** $i_t$：决定写入多少新信息。

$$i_t = \sigma(W_i [h_{t-1}, x_t] + b_i)$$

**候选值** $g_t$：要写入 Cell State 的新内容（用 $\tanh$ 压缩到 $[-1, 1]$）。

$$g_t = \tanh(W_g [h_{t-1}, x_t] + b_g)$$

**输出门** $o_t$：决定从 Cell State 中暴露多少到隐状态。

$$o_t = \sigma(W_o [h_{t-1}, x_t] + b_o)$$

Cell State 和隐状态的更新：

$$C_t = f_t \odot C_{t-1} + i_t \odot g_t$$

$$h_t = o_t \odot \tanh(C_t)$$

注意这里的结构：$C_t$ 的更新路径上只有**逐元素操作**（$\odot$ 和 $+$），没有全连接矩阵乘法。$\tanh$ 出现在 $h_t$ 的计算中，但 $h_t$ 不在 Cell State 的主路径上——它只是一个"分支输出"。

> 📄 **Long Short-Term Memory**
> Sepp Hochreiter, Jürgen Schmidhuber. Neural Computation 1997.
> 提出 LSTM 架构，通过门控机制和 Cell State 解决了 RNN 的梯度消失问题。原文中的 LSTM 还没有遗忘门，后来由 Gers et al. (2000) 补充。

### 2.3 梯度流分析：为什么 LSTM 能记住远处

现在来看关键的数学。Cell State 的更新是：

$$C_t = f_t \odot C_{t-1} + i_t \odot g_t$$

对 $C_{t-1}$ 求偏导：

$$\frac{\partial C_t}{\partial C_{t-1}} = \text{diag}(f_t) + \text{额外项}$$

"额外项"来自 $f_t$、$i_t$、$g_t$ 对 $C_{t-1}$ 的间接依赖（因为这些门的输入包含 $h_{t-1} = o_{t-1} \odot \tanh(C_{t-1})$）。这些项存在，但通常很小。如果我们暂时忽略它们，得到一个简洁的近似：

$$\frac{\partial C_t}{\partial C_{t-1}} \approx \text{diag}(f_t)$$

那么 Cell State 上 $k$ 步的梯度传播就是：

$$\frac{\partial C_t}{\partial C_{t-k}} \approx \prod_{i=t-k+1}^{t} \text{diag}(f_i) = \text{diag}\left(\prod_{i=t-k+1}^{t} f_i\right)$$

这是**逐元素**的乘积，不是矩阵乘法！每个分量独立传播。

当遗忘门学到 $f_i \approx 1$（"记住这个"）时，$\prod f_i \approx 1$，梯度**几乎不衰减**。

对比 vanilla RNN：$\tanh'(z) \in (0, 1]$，大部分区域远小于 1，梯度**必然衰减**。而 LSTM 的 $f_i \in [0, 1]$，可以取到 1——梯度可以无损传播。

这就是为什么 LSTM 能学到长距离依赖：它给梯度提供了一条**不经过非线性压缩**的传播路径。

### 2.4 更完整的梯度流推导

严格来说，Cell State 的梯度流还有从隐状态 $h_t$ 绕回来的路径。完整的梯度包含：

$$\frac{\partial C_t}{\partial C_{t-1}} = \text{diag}(f_t) + \frac{\partial C_t}{\partial h_{t-1}} \cdot \frac{\partial h_{t-1}}{\partial C_{t-1}}$$

第二项是：

$$\frac{\partial h_{t-1}}{\partial C_{t-1}} = \text{diag}(o_{t-1}) \cdot \text{diag}(1 - \tanh^2(C_{t-1}))$$

这里出现了 $\tanh$ 的导数。但关键是：这一项乘以的是 $o_{t-1}$（输出门的值），如果输出门接近 0，这一项几乎为零。换句话说，**输出门在保护 Cell State 的梯度路径**——当不需要输出时，梯度不会从 $h$ 这条路径泄漏出去。

完整的梯度传播：

$$\frac{\partial C_t}{\partial C_{t-1}} = \underbrace{\text{diag}(f_t)}_{\text{主路径：近乎无损}} + \underbrace{\text{额外项}}_{\text{通常很小，被门控抑制}}$$

主路径 dominates，LSTM 的梯度流因此接近恒定。

> 📄 **Learning to forget: continual prediction with LSTM**
> Felix Gers, Jürgen Schmidhuber, Fred Cummins. Neural Computation 2000.
> 为 LSTM 增加了遗忘门（forget gate），使得网络可以主动清除不再需要的记忆。这一改进成为现代 LSTM 的标准配置。

## 3. GRU：做减法的艺术

LSTM 有三个门、一个独立的 Cell State，参数量是 vanilla RNN 的四倍。2014 年，Cho et al. 提出了一个更简洁的设计：**GRU（Gated Recurrent Unit）**——用两个门达到类似的效果。

### 3.1 两个门：重置与更新

GRU 的方程：

**更新门** $z_t$：控制"保留多少旧状态 vs 写入多少新状态"。它同时承担了 LSTM 中遗忘门和输入门的角色。

$$z_t = \sigma(W_z [h_{t-1}, x_t] + b_z)$$

**重置门** $r_t$：决定在计算候选状态时，"看到"多少旧状态。

$$r_t = \sigma(W_r [h_{t-1}, x_t] + b_r)$$

**候选状态** $\tilde{h}_t$：

$$\tilde{h}_t = \tanh(W [r_t \odot h_{t-1}, x_t] + b)$$

**最终状态更新**：

$$h_t = (1 - z_t) \odot h_{t-1} + z_t \odot \tilde{h}_t$$

看最后一个方程——它是 $h_{t-1}$ 和 $\tilde{h}_t$ 的**线性插值**，插值系数是 $z_t$。

当 $z_t \approx 0$ 时：$h_t \approx h_{t-1}$（保留旧状态，什么都不改）。

当 $z_t \approx 1$ 时：$h_t \approx \tilde{h}_t$（完全用新状态替换）。

这和 LSTM 的 Cell State 更新 $C_t = f_t \odot C_{t-1} + i_t \odot g_t$ 在结构上如出一辙——都是旧值和新值的加权组合。

### 3.2 与 LSTM 的关键区别

GRU 做了一个大胆的决定：**去掉 Cell State，让隐状态本身充当记忆载体**。

| 特性 | LSTM | GRU |
|------|------|-----|
| 记忆存储 | 独立的 $C_t$ | 隐状态 $h_t$ 本身 |
| 门的数量 | 3（遗忘、输入、输出） | 2（更新、重置） |
| 遗忘与写入 | 独立控制（$f_t$ 和 $i_t$） | 耦合控制（$z_t$ 和 $1-z_t$） |
| 输出过滤 | 有输出门 $o_t$ | 无，$h_t$ 直接输出 |

最关键的区别是第三点。LSTM 中，遗忘门和输入门是**独立**的——可以同时选择"记住旧的"且"写入新的"。GRU 把这两件事耦合在一起：$z_t$ 大就写入多、遗忘多；$z_t$ 小就保留多、写入少。这在表达能力上是一个限制，但实践表明这个限制的影响通常很小。

另一个区别是 GRU 没有输出门。LSTM 的输出门可以选择性地"隐藏"部分 Cell State，而 GRU 的隐状态完全暴露。这使得 GRU 的隐状态承担了双重角色：既要存储长期记忆，又要作为当前输出。

```text
GRU 信息流
══════════════════════════════════════════════════

  h₀ ──[(1-z₁)·]──[+z₁·h̃₁]──[(1-z₂)·]──[+z₂·h̃₂]── ··· ── h_T
        │    ↑       │    ↑
        │    │       │    │
        │    │       │    h̃ = tanh(W·[r⊙h, x])
        │    │       │
        │    └── r ──┘     重置门控制候选值的计算
        │
     更新门 z 控制新旧比例的插值
```

### 3.3 GRU 的梯度流

GRU 的隐状态更新方程可以改写为：

$$h_t = h_{t-1} + z_t \odot (\tilde{h}_t - h_{t-1})$$

对 $h_{t-1}$ 求偏导：

$$\frac{\partial h_t}{\partial h_{t-1}} = I \cdot (1 - z_t) + \text{额外项}$$

当 $z_t \approx 0$ 时，$\frac{\partial h_t}{\partial h_{t-1}} \approx I$（单位矩阵）！

这意味着：当更新门关闭时，隐状态几乎不变，梯度可以无损地通过 $(1 - z_t)$ 项回传。这和 LSTM 的 Cell State 路径异曲同工——都是给梯度留了一条**恒等映射**的通道。

不过有一个细微差别：LSTM 的梯度恒等路径是 $f_t$（遗忘门值），GRU 的是 $(1 - z_t)$。语义相同，但 GRU 的这条路径同时承载了记忆存储和输出表达两个功能。

> 📄 **Learning Phrase Representations using RNN Encoder-Decoder for Statistical Machine Translation**
> Kyunghyun Cho, Bart van Merrienboer, Caglar Gulcehre, Dzmitry Bahdanau, Fethi Bougares, Holger Schwenk, Yoshua Bengio. EMNLP 2014.
> 提出 GRU，一种参数更少但效果与 LSTM 相近的门控循环单元，最初用于机器翻译的 Encoder-Decoder 框架。

## 4. 三者对比：一张图看清梯度流

### 4.1 梯度传播路径

让我们把三者的梯度回传路径放在一起对比。这是理解它们差异的最直接方式：

```text
梯度回传路径对比（从 t 步回传到 t-k 步）
══════════════════════════════════════════════════════════

Vanilla RNN:
  ∂h_t/∂h_k = ∏ [tanh'(z) · W_hh]
            = tanh'·W · tanh'·W · tanh'·W ···
              ↑ 每步都经过 tanh 压缩 + 矩阵乘法
              → 指数衰减 → 梯度消失

LSTM:
  ∂C_t/∂C_k ≈ ∏ diag(f)
            = f_t · f_{t-1} · f_{t-2} ···
              ↑ 只有逐元素乘法，f ∈ [0,1] 可取 1
              → 可接近常数 → 梯度不消失

GRU:
  ∂h_t/∂h_k ≈ ∏ (1 - z)
            = (1-z_t)·(1-z_{t-1})·(1-z_{t-2})···
              ↑ 逐元素乘法，z ∈ [0,1]，(1-z) 可取 1
              → 可接近常数 → 梯度不消失
```

三者的本质区别可以用一句话概括：**vanilla RNN 的梯度路径上有 $\tanh$ 和 $W_{hh}$，LSTM 和 GRU 的梯度路径上只有门控值**。前者必然衰减，后者可以学会不衰减。

### 4.2 参数量对比

设输入维度为 $n$，隐状态维度为 $h$：

| 架构 | 参数量 | 相对 RNN |
|------|--------|----------|
| Vanilla RNN | $(n + h + 1) \times h$ | $1\times$ |
| LSTM | $4 \times (n + h + 1) \times h$ | $4\times$ |
| GRU | $3 \times (n + h + 1) \times h$ | $3\times$ |

LSTM 有 4 组门（遗忘门、输入门、候选值、输出门），GRU 有 3 组（更新门、重置门、候选值）。每组门都需要 $W_x$（$n \times h$）、$W_h$（$h \times h$）和 $b$（$h$）。

以 $n = h = 128$ 为例：Vanilla RNN 有 32,896 个参数，GRU 有 98,688 个，LSTM 有 131,584 个。

用 PyTorch 验证一下（注意 PyTorch 对 $W_x$ 和 $W_h$ 分别使用 bias，所以参数量是 $2h$ 而非 $h$ 每组门）：

```python
import torch.nn as nn

n, h = 128, 128

rnn  = nn.RNN(n, h)      # 参数: (n×h + h×h) + 2h = 33,024
lstm = nn.LSTM(n, h)     # 参数: 4 × 2(n×h + h×h) + 4×2h = 132,096
gru  = nn.GRU(n, h)      # 参数: 3 × 2(n×h + h×h) + 3×2h = 99,072

print(f"RNN:  {sum(p.numel() for p in rnn.parameters()):,}")
print(f"LSTM: {sum(p.numel() for p in lstm.parameters()):,}")
print(f"GRU:  {sum(p.numel() for p in gru.parameters()):,}")
```

### 4.3 实践中的选择

关于 LSTM 和 GRU 谁更好，学术界没有定论。大量实证研究表明两者在大多数任务上性能相近：

> 📄 **An empirical exploration of recurrent network architectures**
> Klaus Greff, Rupesh Kumar Srivastava, Jan Koutník, Bas R. Steunebrink, Jürgen Schmidhuber. IEEE TNNLS 2017.
> 对 LSTM、GRU 等 RNN 变体进行大规模对比实验，结论是没有单一架构在所有任务上都占优。LSTM 在某些任务上略优，但 GRU 的参数效率更高。

实践中的经验法则：

- **默认选 GRU**：参数更少，训练更快，大多数场景下效果与 LSTM 相当
- **需要精确控制记忆读写时选 LSTM**：独立的遗忘门和输入门提供更细粒度的控制
- **序列很长时两者差距缩小**：LSTM 的 Cell State 在超长序列上可能更稳定
- **在现代架构中，RNN 家族已被 Transformer 和 SSM 取代**：对于新任务，优先考虑 Transformer（短中序列）或 Mamba/RWKV 等线性模型（长序列）

如果你对 RNN 与 Linear Attention 的数学等价性感兴趣——即"Transformer 其实也是一种 RNN"这个令人惊讶的结论——可以阅读[这篇文章](/blog/rnn-to-linear-attention)。

## 结语

回头看这三个架构的演进，核心思想其实只有一个：**给梯度一条不衰减的路**。

Vanilla RNN 的梯度必须穿过 $\tanh$ 和 $W_{hh}$ 的层层挤压，所以信号传不远。LSTM 的解决方案是引入一个独立的 Cell State，让梯度可以沿加法路径近乎无损地传播。GRU 进一步简化，用一个更新门同时控制遗忘和写入，去掉了 Cell State，让隐状态本身成为记忆载体。

门控机制的精妙之处不在于"加了更多参数"，而在于**改变了梯度的拓扑结构**。Vanilla RNN 的梯度只有一条路，必须穿过所有非线性；LSTM 和 GRU 给梯度修了一条旁路，门决定什么时候走旁路、什么时候走主路。这个"给梯度修路"的设计哲学，深刻影响了后来所有的序列模型——从 Highway Network 到 ResNet 的 skip connection，再到现代 SSM 的状态空间设计。

技术迭代很快。今天的大模型几乎不再使用 LSTM 或 GRU。但梯度消失这个问题的解决思路——不是换更大的模型、更多的数据，而是重新设计信息的流动路径——这本身就是一个值得反复品味的工程智慧。

## 参考文献

> 📄 **On the difficulty of training recurrent neural networks**
> Yoshua Bengio, Patrice Simard, Paolo Frasconi. IEEE Transactions on Neural Networks, 1994.
> 首次严格证明 RNN 中梯度消失/爆炸的必然性。

> 📄 **Long Short-Term Memory**
> Sepp Hochreiter, Jürgen Schmidhuber. Neural Computation, 1997.
> 提出 LSTM 架构和 Cell State 概念，开创门控循环网络的先河。

> 📄 **Learning to forget: continual prediction with LSTM**
> Felix Gers, Jürgen Schmidhuber, Fred Cummins. Neural Computation, 2000.
> 为 LSTM 增加遗忘门，形成现代 LSTM 的标准配置。

> 📄 **Learning Phrase Representations using RNN Encoder-Decoder for Statistical Machine Translation**
> Kyunghyun Cho et al. EMNLP, 2014.
> 提出 GRU，用两个门实现与 LSTM 相近的效果。

> 📄 **An empirical exploration of recurrent network architectures**
> Klaus Greff et al. IEEE TNNLS, 2017.
> 大规模对比 LSTM、GRU 等变体，结论是没有单一最优架构。
