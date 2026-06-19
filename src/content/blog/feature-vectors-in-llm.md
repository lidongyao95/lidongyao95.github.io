---
title: 'LLM 中的功能向量：模型在想什么，以及怎么把它抽出来'
date: 2026-06-19
excerpt: '从激活空间中的方向到稀疏自编码器，系统梳理 LLM 功能向量的概念、抽取方法与应用。'
---

## 前言

你给 LLM 一段文字，它经过几十层 Transformer 的处理，最终输出下一个 token。这个过程中间发生了什么？

一种直觉性的回答是：模型在「理解」输入。但这种理解到底长什么样？是某几个神经元在亮？还是某种分布式的模式在变化？

过去两三年，一个研究方向试图回答这个问题：**机械可解释性（Mechanistic Interpretability）**。它的核心假设之一是——LLM 的内部计算可以用一组「功能向量」来理解。每个功能向量对应一个可解释的概念或行为，模型的输出就是这些功能向量相互作用的结果。

这篇文章会带你走一遍这条思路：功能向量是什么？为什么模型内部会存在这样的结构？以及最重要的——我们怎么把它们从模型里抽出来？

## 1. 什么是功能向量

### 1.1 激活空间中的方向

一个 Transformer 在处理每个 token 时，会在每一层产生一个激活向量（通常叫残差流，residual stream）。对于一个隐藏维度 $d_{model} = 4096$ 的模型，每层的激活就是一个 4096 维的向量。

功能向量的核心假设是：

> **激活空间中的某些特定方向，对应着可解释的概念或功能。**

举个具体的例子。当你输入「金门大桥是一座位于旧金山的悬索桥」时，模型在处理「金门大桥」这个 token 时的激活向量里，可能存在某个方向编码了「金门大桥」这个概念。沿着这个方向移动激活向量，模型的后续输出会朝着与金门大桥相关的方向变化。

这听起来有点像 word2vec 时代的类比：

```text
vec("国王") - vec("男人") + vec("女人") ≈ vec("女王")
```

但功能向量的含义要深得多——它不是在词表空间里做算术，而是在模型的内部表示空间里定位具体的概念和行为。

### 1.2 从神经元到特征

早期的可解释性研究关注单个神经元：第 $i$ 个神经元是不是对应某个概念？

但研究发现，单个神经元通常是**多义的（polysemantic）**——同一个神经元可能同时对「猫」「汽车」「法语文本」等多个不相关概念有响应。这不是因为神经元本身复杂，而是因为模型需要编码的概念远多于神经元数量。

这就引出了一个关键区分：

- **神经元（neuron）**：模型架构中的基本计算单元，通常是多义的
- **特征（feature）**：激活空间中的一个方向，对应一个可解释的概念

一个特征可以是多个神经元的线性组合，一个神经元也可以参与多个特征。特征才是真正有意义的分析单元。

### 1.3 一个类比：交响乐与乐器

把模型的激活想象成一段交响乐。如果你只盯着某个小提琴手（单个神经元），你会发现他有时拉旋律、有时拉和声、有时休止。他的行为很难用「一个功能」来解释。

但如果你换一个视角——去追踪「旋律线」「低音线」「和声进行」这些音乐特征（feature），每个特征可能由多个乐器共同演奏，每个乐器也可能同时参与多个特征。

功能向量就是这些「旋律线」——它们是模型内部有意义的结构单元，只是在单个神经元层面被混淆了。

## 2. 叠加假说：为什么神经元不够用

### 2.1 概念比维度多

Elhage 等人在 2022 年提出了**叠加假说（Superposition Hypothesis）**：

> 模型需要编码的概念（特征）数量，远多于它拥有的激活维度数。

一个 $d_{model} = 4096$ 的模型，每层只有 4096 个正交方向。但模型需要区分的概念——各种实体、关系、语法结构、情感倾向、推理模式——可能有数万个甚至更多。

怎么办？模型把多个**近似正交**的特征塞进同一个子空间里。只要特征之间的相关性足够低，这种压缩就不会严重影响模型性能。代价是：单个神经元变得多义，特征不再与坐标轴对齐。

### 2.2 叠加的数学直觉

假设激活空间是 2 维的，模型需要编码 5 个特征。2 维空间只有 2 个正交方向，但可以有无穷多个「近似正交」的方向。

```text
        f₁
       ↗
  f₅ ·    · f₂
    ↗        ↗
  ·            ·
f₄ ← · · · → f₃
```

5 个特征方向以大致均匀的角度分布在 2 维空间中。任何两个方向都不完全正交，但夹角都足够大，使得在添加噪声的情况下仍然可以区分。

在真实的高维空间中，这种现象更加极端。Johnson-Lindenstrauss 引理告诉我们，高维空间中几乎正交的向量数量可以指数级增长。所以一个 4096 维的空间理论上可以容纳远多于 4096 个「近似独立」的特征方向。

### 2.3 叠加的后果

叠加假说意味着：

- 直接观察单个神经元或激活向量的某个坐标，很难得到可解释的信息
- 要理解模型在做什么，需要找到正确的**特征基（feature basis）**——一组与可解释概念对齐的方向
- 这组基通常是**超完备的（overcomplete）**：特征数量多于维度数量

这直接引出了功能向量抽取的核心挑战：如何在超完备的空间中，找到那些有意义的方向？

## 3. 抽取方法概览

抽取功能向量的方法大致可以分为两条路线：

| 路线 | 思路 | 代表方法 |
|------|------|----------|
| **自底向上** | 从激活向量出发，用无监督或弱监督方法分解出特征 | 稀疏自编码器（SAE）、字典学习 |
| **自顶向下** | 从已知行为出发，定位产生该行为的激活位置 | 因果追踪（Causal Tracing）、激活补丁（Activation Patching） |

还有一类更简单的方法——**线性探针（Linear Probe）**——介于两者之间，用标注数据训练一个线性分类器来探测某个概念在哪里被编码。

下面按从简到复杂、从浅到深的顺序展开。

## 4. 线性探针：最朴素的尝试

### 4.1 做法

线性探针的思路非常直接：

1. 收集一批有标注的样本，比如一组文本，标注了「是否包含地理实体」
2. 让 LLM 处理这些文本，收集某一层的激活向量 $h \in \mathbb{R}^{d}$
3. 训练一个线性分类器 $w^T h + b$，预测标签

如果探针的准确率很高，说明这一层的激活空间里确实存在编码「地理实体」的方向，而且这个方向是**线性可分的**。

### 4.2 能告诉我们什么

线性探针可以回答一类重要问题：模型的某一层的激活空间是否编码了某种特定信息？

例如，Li 等人（2023）的研究发现，在 LLaMA 模型的中间层，线性探针能以较高准确率预测文本的语义类别、情感倾向和语法属性。这种「表示探测（representation probing）」为理解模型内部提供了基线参考。

### 4.3 局限性

线性探针有几个明显的局限：

**它只找到线性方向。** 模型可能以非线性方式编码概念，线性探针无法捕捉。

**它只能找你已经知道要找的东西。** 你需要提前设计标签，才能训练探针。那些你没想到的特征，探针发现不了。

**它不解释因果。** 探针准确率高只说明这个信息存在于激活空间中，不说明模型在推理时真的用到了它。一个类比：一本词典里包含「金门大桥」的条目，不代表每篇文章都会提到它。

这些局限催生了更精细的方法。

## 5. 因果追踪与激活补丁：定位关键位置

### 5.1 核心思想

因果追踪（Causal Tracing）由 Meng 等人在 2022 年的 ROME 论文中提出。它要回答的问题是：

> 当模型回答一个事实性问题时，哪些位置的激活对最终答案起了关键作用？

例如，对于输入「埃菲尔铁塔位于哪个城市？」，模型需要正确输出「巴黎」。因果追踪想知道：在这个推理过程中，模型内部哪些层、哪些 token 位置的激活是不可或缺的？

### 5.2 激活补丁（Activation Patching）

因果追踪的核心操作是激活补丁，也叫因果干预。做法分三步：

**第一步：干净前向传播。** 用正确输入 $x_{clean}$ 跑一遍模型，记录每一层的激活，得到正确答案 $y_{clean}$。

**第二步：损坏前向传播。** 用被破坏的输入 $x_{corrupt}$（比如把「埃菲尔铁塔」替换成「大本钟」）跑一遍模型，得到错误答案 $y_{corrupt}$。

**第三步：逐位置恢复。** 在损坏前向传播的基础上，把某个位置 $(l, t)$ 的激活替换回干净前向传播中对应位置的值，然后继续前向传播。观察输出是否从错误恢复成正确。

用公式表示恢复效果：

$$
\text{Effect}(l, t) = P(y_{clean} \mid x_{corrupt}, h^{(l)}_t \leftarrow h^{(l)}_{t, clean}) - P(y_{clean} \mid x_{corrupt})
$$

如果恢复效果很大，说明位置 $(l, t)$ 的激活对于得到正确答案是**因果重要的**。

### 5.3 因果追踪的典型发现

Meng 等人对 GPT-2 和 GPT-Neo 做因果追踪后，发现了一个有趣的两阶段模式：

```text
输入: "The Eiffel Tower is located in"
        │
        ├── 早期层 (Layer 5-8):  主体 token "Eiffel Tower" 的激活
        │   → 编码了「埃菲尔铁塔」的实体身份
        │   → 恢复这里可以修复答案
        │
        ├── 中间层 (Layer 12-16): 最后的主题 token "in" 的激活
        │   → 可能是「关系查找」的计算位置
        │   → 恢复这里也可以修复答案
        │
        └── 晚期层 (Layer 20+):  答案 token 位置
            → 已经是输出了，恢复意义不大
```

这种定位能力非常有价值——它不只是说模型「知道」某个事实，还能告诉你模型在哪些位置「查找」和「使用」了这个知识。

### 5.4 与 ROME 和 MEMIT 的联系

因果追踪不只是分析工具，它直接催生了模型编辑方法。

ROME（Rank-One Model Editing）的思路是：既然事实知识主要存储在早期 MLP 层对主体 token 的处理中，那我们可以通过修改这些层的权重来「编辑」模型的记忆。比如把「埃菲尔铁塔位于巴黎」改成「埃菲尔铁塔位于柏林」。

MEMIT（Mass-Editing Memory in a Transformer）进一步把这个方法扩展到跨层编辑，可以同时修改上千条事实关联。

这些工作共同描绘了一幅图景：Transformer 的不同层和位置承担着不同的功能角色，而激活补丁是定位这些角色的手术刀。

> 📄 **Locating and Editing Factual Associations in GPT**
> Meng, Bau, Belinkov, Tsvetkov. NeurIPS 2022.
> 提出因果追踪和 ROME 方法，首次实现对 GPT 内部事实知识的精确定位和编辑。

> 📄 **Mass-Editing Memory in a Transformer**
> Meng, Rott, Belinkov, Tsvetkov. ICLR 2023.
> 将 ROME 扩展为跨层编辑方法 MEMIT，可同时修改数千条事实关联。

## 6. 稀疏自编码器：从激活中分解特征

如果因果追踪是自顶向下地定位行为，稀疏自编码器（Sparse Autoencoder, SAE）就是自底向上地分解结构。这是目前功能向量研究中最热门的方向之一。

### 6.1 动机

回到叠加假说。模型的激活向量 $h \in \mathbb{R}^d$ 是多个特征的叠加。如果我们能找到一个变换，把 $h$ 分解成一组稀疏激活的特征，那每个特征就更可能对应一个单一的概念。

问题在于：我们不知道有多少个特征，也不知道它们长什么样。SAE 的做法是——假设特征数量 $n$ 远大于维度 $d$，然后通过训练来学习这些特征。

### 6.2 架构与损失函数

SAE 的结构很简单：

```text
输入激活 h ∈ ℝᵈ
    │
    ├── 编码器: f = ReLU(W_enc · (h - b_pre) + b_enc)   → 特征激活 f ∈ ℝⁿ
    │
    └── 解码器: ĥ = W_dec · f + b_pre                    → 重构激活 ĥ ∈ ℝᵈ
```

其中 $n \gg d$（通常是 $d$ 的 2 到 64 倍），所以这是一个超完备的表示。

损失函数由两部分组成：

$$
\mathcal{L} = \underbrace{\| h - \hat{h} \|_2^2}_{\text{重构损失}} + \underbrace{\lambda \| f \|_1}_{\text{稀疏性惩罚}}
$$

**重构损失**确保特征的组合能还原原始激活——我们没有丢失信息。

**稀疏性惩罚（L1 正则化）** 迫使每个输入只激活少数特征——大部分 $f_i$ 接近零。这对应一个直觉：在任何给定时刻，模型同时「想到」的概念只是全部概念的一小部分。

### 6.3 为什么稀疏性关键

没有稀疏性约束，SAE 可以退化成一个普通的线性自编码器——特征之间高度相关，没有可解释性。

稀疏性做的是特征选择：它迫使模型把激活分解成一组**互不相关、各自独立**的基本单元。

这可以类比信号处理中的稀疏编码（Sparse Coding）。Olshausen 和 Field 在 1996 年就用类似的方法，从自然图像的 patch 中学习到了类似初级视觉皮层神经元响应的基函数。SAE 是这个思路在 LLM 激活空间上的现代版本。

### 6.4 Anthropic 的里程碑工作

2023 年，Anthropic 发表了两个重要的 SAE 研究。

Cunningham 等人首先在小模型（1 层 Transformer）上验证了 SAE 的有效性，发现抽取出的特征包括「代码中的缩进层级」「文本中的引用格式」等清晰可解释的概念。

同年晚些时候，Bricken 等人在更大规模的模型（Claude 3 的内部组件）上训练 SAE，抽取了数百万个特征。其中许多特征具有惊人的可解释性：

- **金门大桥特征**：只在输入提到金门大桥时激活，无论用什么语言表达
- **不安全代码特征**：在输入包含可能有害的代码模式时激活
- **欺骗特征**：在输入描述欺骗、撒谎、不诚实行为时激活
- **年份特征**：对文本中提到的具体年份有选择性响应

最令人印象深刻的是，这些特征不是人为设计的，而是模型在无监督训练中自发形成的。

> 📄 **Sparse Autoencoders Find Highly Interpretable Features in Language Models**
> Cunningham, Koyuncu, Mühlhoff. 2023.
> 在小模型上首次系统验证 SAE 抽取可解释特征的有效性。

> 📄 **Towards Monosemanticity: Decomposing Language Models With Dictionary Learning**
> Bricken, Templeton, Batson, Chen, Jermyn, Conerly, et al. Anthropic, 2023.
> 在更大模型上训练 SAE，发现大量可解释特征，包括「金门大桥」特征。

### 6.5 特征的质量评估

怎么判断 SAE 抽取的特征好不好？常用指标有三个：

**可解释性（Interpretability）。** 一个特征是否只在语义一致的输入上激活？这通常需要人工标注或通过自动解释（让另一个 LLM 描述特征的激活模式）来评估。

**稀疏性（Sparsity）。** 一个特征在所有输入中的激活频率。太密集的特征往往不够具体，太稀疏的特征可能只对应极少量的训练数据。

**重构保真度（Reconstruction Fidelity）。** 用特征重构的激活与原始激活之间的误差。如果重构误差大，说明特征集合漏掉了重要信息。

这三个指标之间存在权衡。稀疏性太强会导致重构变差；重构保真度太高可能牺牲特征的稀疏性和可解释性。调好这个平衡是 SAE 训练中的核心工程挑战。

## 7. 激活引导：用功能向量控制模型行为

抽取功能向量不只是为了解释模型，还可以反过来操控模型。这个方向通常叫**激活引导（Activation Steering）**或**表示工程（Representation Engineering）**。

### 7.1 基本思路

如果我们找到了某个概念的功能向量 $\hat{f}$（单位方向向量），就可以通过加减这个向量来改变模型的行为：

$$
h' = h + \alpha \cdot \hat{f}
$$

其中 $\alpha$ 是控制强度的标量。

- $\alpha > 0$：增强这个概念的影响
- $\alpha < 0$：抑制这个概念的影响

操作方式很简单：在推理时，把某一层的激活向量加上偏移量，然后继续前向传播。不需要修改模型参数。

### 7.2 具体例子

**让模型更关注安全。** 如果抽取到了「拒绝回答」的功能向量，给它加一个正的偏移量，模型会更倾向于拒绝潜在危险的请求。反过来，减去它，模型会更愿意回答。

**改变情感倾向。** 抽取「积极情感」方向后，给中性输入加上正向偏移，模型的后续生成会变得更乐观和积极。

**风格迁移。** 抽取「学术写作」和「口语化」的方向向量，可以在生成时平滑切换风格。

### 7.3 获取引导向量的方法

获得功能向量 $\hat{f}$ 有几种途径：

**对比激活差值。** 准备两组输入——一组触发目标行为，一组不触发。计算两组在特定层的激活差值的平均方向：

$$
\hat{f} = \frac{1}{N} \sum_{i=1}^{N} (h^{(l)}_{i, positive} - h^{(l)}_{i, negative})
$$

然后取单位向量作为引导方向。

**SAE 特征。** 直接用 SAE 抽取到的特征方向作为引导向量。优势是特征更可解释，劣势是需要先训练 SAE。

**线性探针权重。** 用线性探针学到的权重向量 $w$ 作为引导方向。简单但受限于线性可分性。

### 7.4 局限和风险

激活引导虽然优雅，但有几个问题值得注意。

**方向不是独立的。** 功能向量之间存在相关性。增强「安全性」可能同时影响「有用性」，因为它们共享一些底层特征。

**层级依赖。** 同一个方向在不同层的效果可能截然不同。在哪一层做引导、引导多大强度，都需要仔细调参。

**鲁棒性未知。** 引导效果可能在大多数情况下有效，但在边界案例上失效。对于安全关键的应用，这还不够可靠。

> 📄 **Representation Engineering: A Top-Down Approach to AI Transparency**
> Zou, Phan, Chen, Campbell, Guo, Li, et al. 2023.
> 提出表示工程框架，系统地用激活向量控制 LLM 的高层行为。

## 8. 跨层特征与最新进展

### 8.1 跨层特征（Cross-Layer Features）

前面的方法大多关注单层激活。但模型的很多功能是跨层协作的。

Templeton 等人在 2024 年的工作中训练了跨层 SAE（Cross-Layer SAE），同时建模多层残差流的激活。结果发现，许多重要特征跨越多个层——它们在早期层开始出现，在中间层达到峰值，在后期层逐渐消退。

这符合 Transformer 的计算直觉：一个概念的处理不是一层完成的，而是通过残差流逐层传递和深化。

### 8.2 自动化特征解释

人工评估特征的可解释性太慢。最新的方向是用另一个 LLM 来解释特征：

1. 收集一个特征激活最强的 $N$ 个输入
2. 把这些输入喂给一个强大的 LLM（如 GPT-4）
3. 让它归纳这些输入的共同主题

Anthropic 和 OpenAI 都在推进这个方向。OpenAI 在 2024 年报告称，他们用 GPT-4 为 GPT-2 XL 中抽取的数万个特征生成了自动解释，其中人类评审者认为大约一半的解释是「大致准确」的。

### 8.3 从功能向量到机械可解释性的完整拼图

功能向量是机械可解释性的一块拼图，但不是全部。完整的机械可解释性希望做到：

- **特征识别**：找到模型内部的可解释特征（SAE 在做这件事）
- **电路发现**：理解特征之间如何相互作用来产生特定行为（Circuit Analysis）
- **全局理解**：把所有电路拼成一个完整的模型行为解释

目前这个领域仍然处于早期。即使是最大的 SAE 也只能解释模型行为的一部分。但对于安全研究和模型调试来说，已经展现了实际价值。

> 📄 **Scaling Monosemanticity: Extracting Interpretable Features from Claude 3 Sonnet**
> Templeton, Conerly, Marcus, Lindsey, et al. Anthropic, 2024.
> 在 Claude 3 Sonnet 上训练跨层 SAE，抽取数百万个特征，是目前最大规模的 SAE 工作之一。

## 9. 实践指南：如果你想自己动手

### 9.1 从线性探针开始

如果你想快速验证模型的某一层是否编码了特定信息，线性探针是最好的起点。只需要：

```python
import torch
from sklearn.linear_model import LogisticRegression

# 1. 收集激活
activations = []  # shape: (N, d_model)
labels = []       # shape: (N,)

for text, label in dataset:
    with torch.no_grad():
        h = model.get_layer_activations(text, layer=12)
    activations.append(h.mean(dim=0).numpy())  # 对 token 取平均
    labels.append(label)

# 2. 训练线性探针
probe = LogisticRegression(C=1.0)
probe.fit(activations, labels)
print(f"探针准确率: {probe.score(test_activations, test_labels):.2%}")

# 3. 探针权重就是候选功能向量方向
feature_direction = probe.coef_[0]
```

### 9.2 尝试激活补丁

如果你想定位模型中哪个位置对某个行为最关键：

```python
def activation_patch(model, clean_input, corrupt_input, layer, token_pos):
    """
    在损坏前向传播中，将 (layer, token_pos) 的激活
    替换为干净前向传播的值，返回正确 logit 的变化。
    """
    # 干净前向传播
    clean_logits = model(corrupt_input)
    clean_logit_correct = clean_logits[0, correct_token_id]

    # 带补丁的前向传播
    with torch.no_grad():
        clean_act = model.get_activation(clean_input, layer, token_pos)

    def hook_fn(module, input, output):
        output[:, token_pos, :] = clean_act
        return output

    handle = model.layers[layer].register_forward_hook(hook_fn)
    patched_logits = model(corrupt_input)
    handle.remove()

    patched_logit_correct = patched_logits[0, correct_token_id]
    return (patched_logit_correct - clean_logit_correct).item()
```

对所有层和所有 token 位置做一遍扫描，就能画出一张因果影响的热力图。

### 9.3 训练一个小型 SAE

如果你想尝试 SAE，这里有一个最小实现：

```python
import torch
import torch.nn as nn

class SparseAutoencoder(nn.Module):
    def __init__(self, d_model, d_feature, device='cuda'):
        super().__init__()
        self.W_enc = nn.Parameter(torch.empty(d_model, d_feature, device=device))
        self.W_dec = nn.Parameter(torch.empty(d_feature, d_model, device=device))
        self.b_pre = nn.Parameter(torch.zeros(d_model, device=device))
        self.b_enc = nn.Parameter(torch.zeros(d_feature, device=device))

        # 初始化：解码器列向量归一化
        nn.init.xavier_uniform_(self.W_enc)
        self.W_dec.data = self.W_enc.data.T.clone()
        self.W_dec.data /= self.W_dec.data.norm(dim=1, keepdim=True)

    def forward(self, x):
        x = x - self.b_pre
        f = torch.relu(x @ self.W_enc + self.b_enc)
        x_recon = f @ self.W_dec + self.b_pre
        return x_recon, f

    def loss(self, x, l1_coeff=1e-3):
        x_recon, f = self.forward(x)
        recon_loss = ((x - x_recon) ** 2).sum(dim=-1).mean()
        l1_loss = l1_coeff * f.norm(1, dim=-1).mean()
        return recon_loss + l1_loss

# 使用示例
sae = SparseAutoencoder(d_model=4096, d_feature=32768)
optimizer = torch.optim.Adam(sae.parameters(), lr=1e-4)

for batch in dataloader:  # batch: (batch_size, d_model) 的激活向量
    loss = sae.loss(batch)
    loss.backward()
    optimizer.step()
    optimizer.zero_grad()

# 推理时查看哪些特征被激活
_, features = sae.forward(test_activation)
top_features = features.topk(10)
```

实际工程中需要注意：训练 SAE 的数据量要大（至少数百万个激活向量），L1 系数要仔细调，解码器的权重需要定期重新归一化以防止特征坍缩。

## 结语

功能向量研究的核心洞察是：LLM 不是一个不可理解的黑箱，而是一组可解释特征的复杂组合。这些特征在激活空间中以特定方向存在，只是因为叠加效应，它们被压缩和混淆，无法通过简单的坐标观察来发现。

从线性探针到因果追踪，从稀疏自编码器到激活引导，我们有了越来越多的工具来定位、抽取和利用这些功能向量。每种方法都有自己的适用场景：

- 想快速验证某层是否编码了特定信息？用线性探针
- 想知道某个行为由哪些位置的计算产生？用因果追踪
- 想系统性地分解模型的内部表示？训练稀疏自编码器
- 想在不改参数的情况下改变模型行为？用激活引导

这个领域还在快速发展。随着模型越来越大、部署越来越广，理解模型内部在做什么将变得越来越重要。功能向量不会是唯一的答案，但它提供了一条有前景的路径——让我们不只知道模型能做什么，还能知道它为什么能做到。

## 参考文献

Elhage, N., Nanda, N., Olsson, C., et al. (2022). *Toy Models of Superposition*. Transformer Circuits Thread.

Meng, K., Bau, D., Belinkov, Y., & Tsvetkov, Y. (2022). *Locating and Editing Factual Associations in GPT*. NeurIPS 2022.

Meng, K., Rott, D., Belinkov, Y., & Tsvetkov, Y. (2023). *Mass-Editing Memory in a Transformer*. ICLR 2023.

Cunningham, H., Koyuncu, A., & Mühlhoff, P. (2023). *Sparse Autoencoders Find Highly Interpretable Features in Language Models*.

Bricken, T., Templeton, A., Batson, J., et al. (2023). *Towards Monosemanticity: Decomposing Language Models With Dictionary Learning*. Anthropic.

Zou, A., Phan, L., Chen, S., et al. (2023). *Representation Engineering: A Top-Down Approach to AI Transparency*.

Templeton, A., Conerly, T., Marcus, J., et al. (2024). *Scaling Monosemanticity: Extracting Interpretable Features from Claude 3 Sonnet*. Anthropic.

Olshausen, B. A., & Field, D. J. (1996). *Emergence of Simple-Cell Receptive Field Properties by Learning a Sparse Code for Natural Images*. Nature, 381(6583), 607–609.
