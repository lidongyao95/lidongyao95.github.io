---
title: 'TUM MVG 6：从两视图走向多视图重建'
date: 2026-07-09
excerpt: '对应 TUM Multiple View Geometry Chapter 6，用 preimage/coimage、rank constraints、multiple-view matrix 和 factorization 理解多视图几何为何比两视图更有约束力。'
group: 'graphics'
---

## 前言

两张图像已经能告诉我们很多：epipolar constraint、essential matrix、triangulation。但如果你真的在做 reconstruction 或 SLAM，很少只满足于两张图。视角越多，证据越多；同时，约束也变得更复杂。

第六讲 **Reconstruction from Multiple Views** 就是在回答：当我们有三张、四张甚至更多图像时，几何关系该怎么组织？

这篇文章对应 `multiviewgeometry6.pdf`。我们会围绕一个贯穿全文的比喻来讲：每张图像给三维世界投下一束“可能性”，多视图重建就是让这些可能性相交，直到只剩下足够小的结构。

## 1. 从 Two Views 到 Multiple Views

### 1.1 多一张图，不只是多一点数据

两视图中，一个点对应给出一条 epipolar constraint。多视图里，同一个三维点在更多图像中出现，就会产生更多联合约束。

课件强调：传统上三视图关系常用 trifocal tensor 表达，但这门课选择用 **multiview matrices** 和 rank constraints 来组织。好处是它能把点和线的 preimage/coimage 放进统一框架。

### 1.2 多视图像多个人从不同角度指路

一张图像说：“点在这条射线上。”两张图像说：“点应该在两条射线交会处。”三张以上图像则继续验证这个交会是否一致。

如果观测有噪声，多视图不会让问题自动完美，但它能让错误更难藏起来。

## 2. Preimage：图像观测背后的三维集合

### 2.1 点的 preimage 是射线，线的 preimage 是平面

第三讲已经埋过伏笔：图像点的 preimage 是一条穿过相机中心的射线；图像线的 preimage 是一个穿过相机中心的平面。

<figure>
  <img src="/images/tum-mvg-courseware/tum-mvg-06-p06.png" alt="TUM MVG Chapter 6 slide: preimage and coimage of points and lines" />
  <figcaption>TUM MVG Chapter 6 截图：点和线在多视图中的 preimage/coimage，决定了它们如何约束三维结构。</figcaption>
</figure>

从这个角度看，多视图约束不是从公式里掉出来的，而是从这些射线和平面的交会关系里长出来的。

### 2.2 Coimage 是约束的正交补

课件里还讨论 coimage。直觉上，preimage 描述“哪些三维点可能产生这个观测”，coimage 描述与这些可能性正交的约束方向。

当我们把多个视图的 coimage 堆在一起，就能得到一个矩阵；这个矩阵的秩告诉我们约束是否足够强。

## 3. Rank Constraints：多视图的压缩语言

### 3.1 为什么秩能表达几何

很多几何关系都可以写成：“某些向量应该线性相关”。而线性相关最自然的代数表达就是矩阵秩下降。

例如一个三维点在多个视图里的观测，对应的 multiview matrix 应该有特定的 rank。若秩太高，说明这些观测不能来自同一个三维点；若秩符合条件，说明它们几何上自洽。

<figure>
  <img src="/images/tum-mvg-courseware/tum-mvg-06-p16.png" alt="TUM MVG Chapter 6 slide: rank constraints geometric interpretation" />
  <figcaption>TUM MVG Chapter 6 截图：rank constraint 的几何解释来自多个 preimage 的相交关系。</figcaption>
</figure>

### 3.2 两视图约束是多视图约束的特例

课件指出，多视图矩阵和 epipolar constraints 之间有直接关系。也就是说，第五讲的 $x_2^\top E x_1=0$ 并没有被推翻，而是被包含进更大的框架里。

这很像从两人对话扩展到多人会议。两人之间的关系仍然存在，但会议记录里还包含三人、四人之间的相互一致性。

## 4. Multiple-View Matrix of a Point

### 4.1 把每个视图的投影约束堆起来

一个三维点 $X$ 在第 $i$ 个视图中满足：

$$
\lambda_i x_i = \Pi_i X
$$

消去深度 $\lambda_i$ 后，可以把各视图的约束堆成矩阵。这个矩阵是否有非零 null space，决定了是否存在一个三维点能解释所有观测。

### 4.2 Uniqueness 与 degeneracy

多视图并不保证永远唯一。课件专门讨论 degeneracies：某些相机配置或特征配置会让 preimage 不唯一。

比如所有视线几何关系过于特殊，或者点落在某些退化结构上，rank constraint 可能不足以锁定唯一三维点。这提醒我们，更多数据不等于无条件可解；数据还要有几何多样性。

## 5. Factorization：把运动和结构一起拆出来

### 5.1 多视图矩阵可以揭示低秩结构

课件后面讲 **multiple-view factorization of point features**。这和经典 Tomasi-Kanade factorization 有相似精神：把观测矩阵分解成 motion 和 structure 两部分。

<figure>
  <img src="/images/tum-mvg-courseware/tum-mvg-06-p31.png" alt="TUM MVG Chapter 6 slide: multiple-view factorization of point features" />
  <figcaption>TUM MVG Chapter 6 截图：多视图点特征的 factorization 从 rank condition 中同时恢复 motion 与 structure。</figcaption>
</figure>

### 5.2 已知结构估运动，已知运动估结构

在真实系统中，我们常常交替处理两个子问题：

```text
known structure -> estimate motion
known motion    -> estimate structure
```

这就是很多 SLAM 和 SfM pipeline 的节奏。新帧进来，先用已有地图估 pose；pose 稳了，再 triangulate 新点；积累到一定程度后，再整体优化。

## 6. 一个最小实践：用秩检查观测一致性

### 6.1 SVD 看约束是否接近退化

```python
import numpy as np

def numerical_rank(A, tol=1e-8):
    s = np.linalg.svd(A, compute_uv=False)
    return int(np.sum(s > tol)), s

A_good = np.array([
    [1, 0, -2, 0],
    [0, 1, -1, 0],
    [1, 0, -2, 0.01],
    [0, 1, -1, -0.02],
], dtype=float)

A_bad = np.array([
    [1, 0, -2, 0],
    [2, 0, -4, 0],
    [3, 0, -6, 0],
    [4, 0, -8, 0],
], dtype=float)

for name, A in [("good", A_good), ("degenerate", A_bad)]:
    rank, s = numerical_rank(A)
    print(name, "rank:", rank, "singular values:", s)
```

这不是完整的 multiview matrix 实现，但它展示了 rank constraint 的基本诊断方式：奇异值谱会告诉你约束是否真的提供了独立信息。

### 6.2 Rank constraint 的工程读法

在真实系统里，我们很少直接拿一条 rank theorem 当最终算法。更常见的做法，是把它变成诊断信号或初始化工具。

如果某个局部窗口里的点全部来自近似平面，homography 会解释得很好，general 3D reconstruction 反而可能不稳定。如果相机几乎只做纯旋转，triangulation 的 baseline 太小，深度也会变得脆弱。

这些情况都可以从奇异值谱里看出端倪：本该被拉开的方向没有拉开，本该独立的约束变得接近线性相关。

### 6.3 多视图不是越多越无脑

多视图给了我们更多观测，但也带来新的管理问题。哪些帧应该放进窗口？哪些点已经过时？哪些相机位姿需要一起优化？如果全部保留，计算会爆炸；如果删得太狠，几何约束又不够。

这就是 keyframe selection 和 map management 的价值。一个好的系统不是把所有帧都塞进优化器，而是保留最能提供视差、覆盖和稳定约束的那些帧。

```text
new frame arrives
      |
      v
enough parallax? enough new scene?
      |
      +-- no  -> tracking only
      |
      +-- yes -> promote to keyframe
```

### 6.4 和第七讲 BA 的连接

第六讲仍然偏线性和结构分析，第七讲会把这些线性初值放进 nonlinear optimization 里精修。你可以把 multiview rank constraints 看成“哪些解几何上可能”，而 BA 看成“在噪声下哪个可能解最贴近观测”。

这两个视角互补。没有结构约束，优化器容易乱跑；没有非线性优化，线性解又很难达到真实数据上的最佳精度。

### 6.5 读论文时的关键词

读多视图重建论文时，遇到这些词可以把它们挂回本讲：

| 关键词 | 对应直觉 |
|---|---|
| trifocal tensor | 三视图联合约束 |
| rank constraint | 观测矩阵的线性相关性 |
| factorization | 低秩结构拆成 motion 与 structure |
| degeneracy | 观测配置不足以唯一决定结构 |

### 6.6 一个阅读检查点

如果你读完第六讲能回答三个问题，主线就抓住了：一个图像点的 preimage 是什么？多个 preimage 相交为什么会产生 rank constraint？什么时候更多视图仍然会退化？

这三个问题比记住每个矩阵的具体排布更重要，因为它们决定你是否真的理解了多视图约束的来源。

## 7. 资料来源

本文对应 TUM Multiple View Geometry 课程 Chapter 6: **Reconstruction from Multiple Views**, Prof. Daniel Cremers, Summer 2019。

> 📄 **Shape and Motion from Image Streams under Orthography: A Factorization Method**
> Carlo Tomasi and Takeo Kanade. IJCV 1992.
> 用低秩 factorization 同时恢复相机运动和三维结构，是多视图重建里的经典思想。

## 结语

第六讲把两视图几何从一条 epipolar relation 扩展成了多视图约束网络。它最值得带走的直觉是：每个图像观测都不是一个孤立点，而是一组关于三维空间的可能性；多视图重建就是让这些可能性互相交叉、互相排除。

Rank constraints 是这套想法的压缩语言。它把复杂的射线、平面和相交关系，变成矩阵秩是否下降的问题。到这里，线性代数又一次回到舞台中央，只是这次它不再是预备知识，而是直接在组织三维世界。
