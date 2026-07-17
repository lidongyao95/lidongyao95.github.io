---
title: 'TUM MVG 7：Bundle Adjustment 为什么是重建系统的精修工序'
date: 2026-07-09
excerpt: '对应 TUM Multiple View Geometry Chapter 7，从噪声下的最优性、reprojection error、nonlinear least squares 到 Gauss-Newton 与 Levenberg-Marquardt 理解 BA。'
group: 'graphics'
---

## 前言

线性算法很像快速打草稿：eight-point algorithm、triangulation、factorization 可以迅速给出一个可用初值。但真实图像有噪声，点对应有误差，相机模型也不完美。草稿要变成精图，就需要整体精修。

第七讲 **Bundle Adjustment & Nonlinear Optimization** 讲的正是这道精修工序。Bundle Adjustment，简称 BA，是 SfM、SLAM、三维重建系统里绕不开的核心。

你可以把 BA 想成摄影棚里调灯：相机位姿、三维点、内参都可以微调，目标只有一个，让所有投影尽可能贴近真实观测。

## 1. 为什么线性解还不够

### 1.1 噪声让闭式解偏离最优

课件开头说得很直接：线性方法优雅，因为它们常常能用 SVD 得到 closed-form solution。但这些方法通常没有显式建模观测噪声，因此在真实数据上不一定最优。

<figure>
  <img src="/images/tum-mvg-courseware/tum-mvg-07-p05.png" alt="TUM MVG Chapter 7 slide: bundle adjustment and nonlinear optimization objective" />
  <figcaption>TUM MVG Chapter 7 截图：在 Gaussian noise 假设下，maximum likelihood 会导向 reprojection error 的最小化。</figcaption>
</figure>

如果观测点 $\tilde{x}_{ij}$ 带有零均值高斯噪声，那么最大似然估计会变成最小化平方 reprojection error。

### 1.2 Reprojection error 是视觉系统的共同货币

BA 的典型目标函数是：

$$
\min_{\{R_i,T_i\},\{X_j\}}
\sum_{i,j}
\left\|\tilde{x}_{ij} - \pi(R_i,T_i,X_j)\right\|^2
$$

它的意思很朴素：当前估计的相机和三维点投影回图像后，离真实观测有多远？

这是一种非常实用的共同货币。无论三维点、相机姿态还是内参怎么参数化，最终都要在像素平面上交账。

## 2. Bundle Adjustment 在调整什么

### 2.1 Bundle 这个词很形象

每个三维点会向多个相机投出一束光线。所有相机和所有点连成一大 bundle。BA 就是在调整这束光线的整体结构，让它们更一致地穿过观测像素。

可优化变量包括：

| 变量 | 常见内容 |
|---|---|
| camera pose | $R_i,T_i$ 或 SE(3) 参数 |
| structure | 三维点 $X_j$ |
| intrinsics | $K$、焦距、主点 |
| distortion | radial/tangential coefficients |

### 2.2 参数化会影响优化难度

同一个问题可以用不同参数化表达。比如旋转可以用 matrix、quaternion、axis-angle 或 Lie algebra 更新。参数化选得不好，会让优化走到非法区域或数值不稳定。

这就是第二讲运动表示的重要性：BA 不只是“套一个 least squares”，它还必须尊重相机位姿所在的几何空间。

## 3. Nonlinear Least Squares：为什么要迭代

### 3.1 投影函数是非线性的

相机投影里有除以深度的步骤：

$$
u = f_x \frac{X_c}{Z_c} + o_x
$$

因此 reprojection error 对相机位姿和三维点不是线性函数。我们只能在当前估计附近线性化，然后迭代改进。

### 3.2 Gauss-Newton：忽略二阶项的聪明近似

设 residual 为 $r(\theta)$，目标是：

$$
E(\theta)=\frac{1}{2}\|r(\theta)\|^2
$$

线性化：

$$
r(\theta+\Delta)\approx r(\theta)+J\Delta
$$

解 normal equation：

$$
J^\top J\Delta = -J^\top r
$$

<figure>
  <img src="/images/tum-mvg-courseware/tum-mvg-07-p17.png" alt="TUM MVG Chapter 7 slide: Gauss-Newton algorithm" />
  <figcaption>TUM MVG Chapter 7 截图：Gauss-Newton 用 residual 的 Jacobian 构造局部二次近似。</figcaption>
</figure>

如果当前估计已经比较接近真实解，Gauss-Newton 往往很高效。

## 4. Levenberg-Marquardt：在大胆和谨慎之间切换

### 4.1 给 Hessian 加阻尼

Levenberg-Marquardt (LM) 修改 normal equation：

$$
(J^\top J + \lambda I)\Delta = -J^\top r
$$

当 $\lambda$ 小时，它像 Gauss-Newton；当 $\lambda$ 大时，它更像 gradient descent。

<figure>
  <img src="/images/tum-mvg-courseware/tum-mvg-07-p19.png" alt="TUM MVG Chapter 7 slide: Levenberg-Marquardt algorithm" />
  <figcaption>TUM MVG Chapter 7 截图：LM 通过 damping 在 Gauss-Newton 和 gradient descent 之间平衡。</figcaption>
</figure>

这有点像开车下山：路况清楚时大胆走捷径，路况不明时放慢脚步。

### 4.2 Robust cost 是现实世界的保险

如果对应点里有 outliers，纯平方损失会被异常值强烈拉偏。工程 BA 常用 Huber、Cauchy 等 robust loss，把大残差的影响压下来。

这不是数学洁癖，而是救命措施。真实 reconstruction 里，错匹配、动态物体、遮挡都会出现。

## 5. 稀疏结构：BA 为什么能做大

### 5.1 Jacobian 很稀疏

每个 residual 只依赖一个相机和一个三维点，不依赖所有变量。因此 BA 的 Jacobian 有强烈稀疏结构。

```text
residual r_ij depends on:
  camera i
  point j
```

这让 Schur complement 等技巧可以把点变量消掉，先解相机更新，再回代点更新。

### 5.2 这也是 SLAM 后端的核心

现代 visual SLAM 的后端，本质上就是不同规模的 nonlinear least squares：local BA、pose graph optimization、windowed optimization 都在这条线上。

第八讲的 direct methods 也会继续使用这个思想，只是 residual 从 feature reprojection error 变成 photometric error。

## 6. 一个最小实践：一维 Gauss-Newton

### 6.1 拟合一个非线性模型

```python
import numpy as np

x = np.linspace(0, 1, 20)
y = 2.0 * np.exp(1.5 * x) + 0.05 * np.random.default_rng(0).normal(size=x.shape)

theta = np.array([1.0, 1.0])  # a, b for a * exp(bx)
for _ in range(10):
    a, b = theta
    pred = a * np.exp(b * x)
    r = pred - y
    J = np.stack([
        np.exp(b * x),
        a * x * np.exp(b * x),
    ], axis=1)
    delta = np.linalg.solve(J.T @ J, -J.T @ r)
    theta += delta

print(theta)
```

这不是 BA，但它展示了同一件事：非线性 residual，局部线性化，解一个 normal equation，再迭代。

### 6.2 BA 调试时先看 residual 分布

真实 BA 出问题时，不要只看最后的总 loss。总 loss 会把很多线索揉成一个数，容易骗人。更好的做法是画 residual histogram，或者按相机、按点、按图像区域查看 reprojection error。

如果某一台相机的 residual 系统偏大，可能是该帧 pose 初值差；如果图像边缘 residual 大，可能是畸变模型不够；如果少数点 residual 爆炸，通常是 outlier 或错误匹配。

### 6.3 Gauge freedom 也要记在心里

纯视觉重建经常存在尺度或坐标系自由度。比如 monocular SfM 没有绝对尺度，整体放大或缩小都能解释同样的图像观测。

因此优化时通常要固定一个参考位姿，或者加入先验约束。否则 Hessian 会有不可观测方向，数值上表现为病态或奇异。

这一点看似细枝末节，实际是很多 BA 崩溃案例的源头。

## 7. 资料来源

本文对应 TUM Multiple View Geometry 课程 Chapter 7: **Bundle Adjustment & Nonlinear Optimization**, Prof. Daniel Cremers, Summer 2019。

> 📄 **Bundle Adjustment — A Modern Synthesis**
> Bill Triggs, Philip McLauchlan, Richard Hartley, Andrew Fitzgibbon. Vision Algorithms 1999.
> 系统总结 BA 的目标函数、参数化、稀疏性和鲁棒优化，是理解 SfM 后端的经典综述。

## 结语

Bundle Adjustment 的精神很简单：不要只满足于局部闭式解，而是让所有相机、所有三维点、所有观测一起对账。它把多视图几何从“能解”推进到“尽量最优”。

真正难的地方在工程细节：好初值、好参数化、稀疏线性代数、robust loss、边缘化策略、收敛判断。可一旦你理解 reprojection error 这枚硬币，BA 的复杂性就有了中心。所有调参和实现技巧，最终都是为了让这枚硬币在真实噪声里更诚实地落地。
