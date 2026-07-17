---
title: 'TUM MVG 10：把多视图重建写成形状优化问题'
date: 2026-07-09
excerpt: '对应 TUM Multiple View Geometry Chapter 10，从 explicit/implicit shape representation 到 silhouette consistency、convex relaxation、minimal surface 与 super-resolution texture reconstruction。'
group: 'graphics'
---

## 前言

前面几讲里，三维结构常常以点云、线、深度图的形式出现。但真实世界的物体是表面：雕像、杯子、人体、房间墙面。第十讲 **Variational Multiview Reconstruction** 把问题换了一个问法：能不能直接把三维形状当作优化变量？

这篇文章对应 `multiviewgeometry10.pdf`。它延续第九讲的变分思想，但未知量从图像函数 $u$ 变成了三维 shape。我们会看 explicit / implicit representations、silhouette consistency、minimal surface、convex relaxation 和 texture reconstruction。

如果说前几讲是在恢复“点在哪里”，这一讲更像在问：“哪一个三维表面最能解释所有相机看到的图像？”

## 1. Shape Representation：先决定怎么写形状

### 1.1 Explicit representation：直接描边

显式表示把曲线或曲面写成参数映射。比如一条闭曲线：

$$
C:S^1\rightarrow \mathbb{R}^d
$$

样条曲线、网格顶点、控制点都属于这个家族。它们的好处是紧凑，适合精确控制局部几何。

### 1.2 Implicit representation：用函数描述内外

隐式表示则定义一个体素域上的函数，比如 indicator function 或 signed distance function：

$$
u(x)=
\begin{cases}
1,&x\in \text{inside}(S)\\
0,&x\in \text{outside}(S)
\end{cases}
$$

<figure>
  <img src="/images/tum-mvg-courseware/tum-mvg-10-p07.png" alt="TUM MVG Chapter 10 slide: explicit versus implicit representations" />
  <figcaption>TUM MVG Chapter 10 截图：explicit representation 紧凑但拓扑变化困难，implicit representation 更占内存但更容易处理复杂拓扑。</figcaption>
</figure>

显式表示像用钢丝勾勒外形，隐式表示像给空间每个位置贴上“内/外/边界”的标签。

## 2. Multiview Reconstruction as Shape Optimization

### 2.1 不再显式匹配所有像素

课件提出一个很有意思的转向：与其估计所有图像之间的像素对应，不如直接问某个体素是否属于目标物体。

如果一个三维体素投影到多张图像后颜色一致，或者符合 silhouette 约束，它更可能在表面上；否则就应该被排除。

### 2.2 Photoconsistency 与 surface cost

多视图形状优化常会定义一个 surface cost：

$$
E(S)=\int_S \rho(x)\,dA
$$

$\rho(x)$ 可以来自 photoconsistency：如果点 $x$ 投影到多张图像颜色一致，cost 低；不一致，cost 高。

问题是，单靠这个能量可能产生空表面或不合理表面，所以还要加 silhouette、regularization 等约束。

## 3. Silhouette Consistency：轮廓是强约束

### 3.1 物体投影不能跑出 silhouette

如果我们知道每张图中的 foreground silhouette，那么三维形状投影到该图时，应该落在 silhouette 内部。

<figure>
  <img src="/images/tum-mvg-courseware/tum-mvg-10-p11.png" alt="TUM MVG Chapter 10 slide: imposing silhouette consistency" />
  <figcaption>TUM MVG Chapter 10 截图：silhouette consistency 要求物体表面投影与每个视角的前景轮廓一致。</figcaption>
</figure>

这条约束非常强。即使没有纹理，仅凭多个视角的轮廓，也能恢复 visual hull。

### 3.2 Visual hull 是外壳，不是全部细节

Visual hull 会包含所有能解释 silhouette 的体积，但它无法恢复轮廓看不见的凹陷。比如杯子的内凹部分，如果 silhouette 没有暴露出来，就很难仅靠轮廓恢复。

因此真实系统通常结合 silhouette consistency 和 photoconsistency：一个保证外形不离谱，一个负责表面细节。

## 4. Convex Relaxation：把难问题变得可解

### 4.1 形状优化通常是非凸的

直接在所有可能表面中找最优，通常是非常困难的非凸问题。第十讲介绍的一个策略是把二值函数 $u\in\{0,1\}$ 放宽成连续区间 $u\in[0,1]$。

这样原来的组合/几何问题可以转成更容易求解的凸优化形式。最后再 threshold 得到二值形状。

### 4.2 Relaxation 不是偷懒，而是换路

你可以把 convex relaxation 想成爬山时先把崎岖山路变成一条更平滑的坡。我们不再直接在所有离散形状之间跳，而是在连续空间里找一个全局更可靠的解，再投回离散形状。

当然，relaxation 是否 tight、threshold 是否稳定，仍然依赖问题结构。

## 5. Texture Reconstruction：形状之后还有外观

### 5.1 几何表面只是第一层

重建出形状以后，我们还希望得到 texture。多视图纹理重建需要把不同相机看到的颜色融合到表面上。

<figure>
  <img src="/images/tum-mvg-courseware/tum-mvg-10-p17.png" alt="TUM MVG Chapter 10 slide: super-resolution texture reconstruction" />
  <figcaption>TUM MVG Chapter 10 截图：super-resolution texture reconstruction 利用多张低分辨率观测恢复更清晰的表面纹理。</figcaption>
</figure>

这时会遇到曝光差异、遮挡、视角相关反射、配准误差等问题。

### 5.2 Super-resolution texture 的直觉

如果一个表面 patch 被多张图片从不同子像素位置观察到，我们可以把这些观测融合成更高分辨率纹理。这和图像超分辨率类似，只是采样发生在三维表面上。

形状越准，纹理融合越稳；形状有偏，纹理就会糊或重影。

## 6. Space-Time Reconstruction：从静态到动态

### 6.1 多视图视频增加时间维

课件最后提到 space-time reconstruction 和 free-viewpoint television。静态物体重建已经不简单，动态场景还要处理时间一致性。

这时 shape 变成 $S(t)$，优化不仅要解释每一帧的多视图观测，还要让时间上的形状变化合理。

### 6.2 这和现代 NeRF / 3D Gaussian 有精神连续性

虽然这套课件早于今天很多 neural rendering 热潮，但思想并不陌生：选择一个场景表示，定义多视图观测误差，加上正则化，然后优化表示参数。

区别在于，今天的表示可能是 neural field 或 Gaussian primitives；但“用多视图一致性约束三维结构”的核心没有变。

## 7. 一个最小实践：体素 silhouette carving

### 7.1 用多个二值 mask 削掉不可能体素

```python
import numpy as np

voxels = np.array([
    [-1, 0, 3],
    [0, 0, 3],
    [1, 0, 3],
    [0, 1, 3],
], dtype=float)

def project_front(x):
    return np.array([x[0] / x[2], x[1] / x[2]])

def project_side(x):
    return np.array([x[1] / x[2], x[0] / x[2]])

def inside_unit_mask(p):
    return np.linalg.norm(p) < 0.35

kept = []
for v in voxels:
    ok = inside_unit_mask(project_front(v)) and inside_unit_mask(project_side(v))
    kept.append(ok)

print(np.c_[voxels, kept])
```

这个玩具例子不是完整 visual hull，但它保留了 silhouette consistency 的核心动作：如果一个体素在任一视角投影到前景外，就把它削掉。

### 7.2 形状优化里的三种证据

读第十讲时，可以把多视图形状优化里的证据分成三类。

第一类是 silhouette evidence。它不需要纹理，只需要前景分割，但只能恢复 visual hull 级别的外壳。

第二类是 photoconsistency evidence。它利用多视角颜色一致性，能恢复更多凹凸细节，但会被光照、反射和遮挡干扰。

第三类是 regularization evidence。它不是来自图像，而是来自我们对形状的先验，比如表面不应无限抖动、体积不应碎成噪声。

一个好模型通常不是只靠其中一种证据，而是在三者之间分配权重。

### 7.3 和神经隐式重建的连接

如果把 implicit representation 从体素函数换成 neural field，第十讲的很多思想仍然成立。Occupancy Network、SDF-based reconstruction、NeRF-derived surface methods 都在问类似问题：一个空间函数如何解释多视图观测？

区别在于，过去我们显式写 convex relaxation 或 PDE；今天我们也可能把函数参数交给 MLP，再用 differentiable rendering 反传梯度。但 silhouette、photoconsistency、regularization 这些老朋友仍然在场。

### 7.4 一个阅读检查点

读完这一讲，试着解释 explicit mesh、voxel occupancy、signed distance function 三者各自适合什么场景。能说清楚表示的取舍，就能理解为什么形状优化从来不只是优化算法的问题。

## 8. 资料来源

本文对应 TUM Multiple View Geometry 课程 Chapter 10: **Variational Multiview Reconstruction**, Prof. Daniel Cremers, Summer 2019。

> 📄 **A Convex Formulation for Multiview Reconstruction**
> Kolev, Cremers 等. ECCV 2008.
> 将多视图重建写成带 silhouette consistency 的凸优化问题，是本讲 variational multiview reconstruction 的重要背景。

## 结语

第十讲把整套 MVG 课程推到一个很完整的位置：我们不只想恢复相机和点，还想恢复能解释所有图像的三维形状。为此，必须先选择形状表示，再设计能量函数，再用优化方法求解。

这也解释了为什么多视图几何和变分方法会自然相遇。几何告诉我们观测如何约束空间，变分方法告诉我们怎样把约束和先验写成一个可求解的目标。到这里，二维图像终于不只是像素矩阵，而变成了雕刻三维世界的一组投影刀痕。
