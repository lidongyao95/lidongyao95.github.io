---
title: 'TUM MVG 5：两张图如何线性恢复相机运动与结构'
date: 2026-07-09
excerpt: '对应 TUM Multiple View Geometry Chapter 5，围绕 epipolar constraint、essential matrix、eight-point algorithm、triangulation、homography 与 fundamental matrix 梳理两视图重建。'
group: 'graphics'
---

## 前言

现在我们已经有了投影模型，也知道如何在两张图之间找对应点。下一步自然是：能不能只凭这些对应点，恢复相机相对运动和三维点位置？

第五讲 **Reconstruction from Two Views: Linear Algorithms** 进入多视图几何的经典核心。它的主角是 epipolar geometry，以及那条非常有名的约束：

$$
x_2^\top E x_1 = 0
$$

如果 [Simple Stereo](/blog/simple-stereo-vision) 是一个规整的双目特例，那么这一讲讨论的是更一般的两视图重建：相机可以旋转、平移，不再只是水平 baseline。

## 1. 两视图重建问题

### 1.1 已知什么，未知什么

课件把问题设定得很清楚：我们有两张图，若干点对应，且相机内参已知。目标是估计：

```text
camera motion: R, T
3D structure: X_1, ..., X_N
```

如果一共有 100 个点，二维观测有 200 个坐标，但三维点和相机运动的未知量更多。直接解这个问题并不轻松，所以我们先找几何约束来消元。

### 1.2 Epipolar plane 是两条光线的共同舞台

<figure>
  <img src="/images/tum-mvg-courseware/tum-mvg-05-p06.png" alt="TUM MVG Chapter 5 slide: epipolar geometry notation" />
  <figcaption>TUM MVG Chapter 5 截图：三维点、两个相机中心和两条投影光线共面，形成 epipolar plane。</figcaption>
</figure>

同一个三维点在两张图中的观测，和两个相机中心共同定义一个平面。这个平面就是 epipolar plane。它把“两个点是否可能对应”变成一个可检验的代数关系。

## 2. Essential Matrix：把相对运动压进一个矩阵

### 2.1 从几何共面到代数约束

在 calibrated camera 下，归一化图像点满足：

$$
x_2^\top \hat{T}R x_1 = 0
$$

定义：

$$
E = \hat{T}R
$$

就得到：

$$
x_2^\top E x_1 = 0
$$

<figure>
  <img src="/images/tum-mvg-courseware/tum-mvg-05-p08.png" alt="TUM MVG Chapter 5 slide: epipolar constraint" />
  <figcaption>TUM MVG Chapter 5 截图：epipolar constraint 只依赖两个图像点和相机相对运动。</figcaption>
</figure>

这条式子非常紧凑。它不需要显式知道三维点深度，却约束了两张图里的对应点和相机运动。

### 2.2 Essential matrix 有结构

不是任意 $3\times 3$ 矩阵都是 essential matrix。合法的 $E$ 应该有两个相等的非零奇异值和一个零奇异值。

这就是为什么 eight-point algorithm 线性估计之后，还要把结果投影回 essential space。线性解负责方便，结构投影负责合法。

## 3. Eight-Point Algorithm：把几何问题摊成线性方程

### 3.1 每个点对给一条线性约束

把 $E$ 的 9 个元素展成向量 $e$，一个对应点对可以写成：

$$
a_i^\top e = 0
$$

至少 8 对点可以组成一个齐次线性系统：

$$
Ae=0
$$

<figure>
  <img src="/images/tum-mvg-courseware/tum-mvg-05-p11.png" alt="TUM MVG Chapter 5 slide: eight-point linear algorithm" />
  <figcaption>TUM MVG Chapter 5 截图：Eight-point algorithm 用 Kronecker product 把 epipolar constraint 改写成线性系统。</figcaption>
</figure>

这就是第一讲 SVD 工具回来的地方：取 $A$ 最小奇异值对应的右奇异向量，就是噪声下的线性估计。

### 3.2 为什么八点不是故事终点

课件也提醒我们，eight-point algorithm 很优雅，但不等于工程上直接够用。真实流程通常还需要：

| 问题 | 常见处理 |
|---|---|
| outliers | RANSAC |
| 坐标尺度差 | point normalization |
| essential 结构 | SVD projection |
| 噪声最优性 | nonlinear refinement |

线性算法像一把好用的开锁器，先把门打开；真正住进去，还得靠 bundle adjustment 打扫房间。

## 4. Structure Reconstruction：从 E 回到三维点

### 4.1 运动恢复后再 triangulate

一旦从 $E$ 中恢复出候选 $R,T$，就可以对每个点对做 triangulation。直觉很简单：两张图各给一条射线，三维点应该在两条射线最接近的位置。

现实里两条射线往往不会完美相交，因为观测有噪声。于是 triangulation 也是一个最小二乘问题。

### 4.2 Cheirality 帮我们选正确解

从 essential matrix 分解 $R,T$ 会得到多个候选。正确的那个应该让三维点在两个相机前方，也就是深度为正。

这个条件叫 **cheirality constraint**。它很朴素：如果恢复出来的世界大部分在相机背后，那肯定选错了解。

## 5. Homography 与 Fundamental Matrix

### 5.1 平面场景会退化

如果所有点都在一个平面上，点对应也可以由 homography 描述：

$$
x_2 \sim Hx_1
$$

这时从 epipolar geometry 恢复三维结构会出现退化，因为观测没有足够的空间变化来区分一般三维结构。

### 5.2 未标定相机使用 Fundamental Matrix

如果内参 $K$ 未知，像素坐标之间的约束写成：

$$
x_2^\top F x_1 = 0
$$

它和 essential matrix 的关系是：

$$
F = K_2^{-\top} E K_1^{-1}
$$

所以 $F$ 是更一般的像素级 epipolar geometry，而 $E$ 是归一化相机坐标里的运动几何。

## 6. 一个最小实践：估计一个 rank-2 fundamental matrix

### 6.1 线性求解加 rank 投影

```python
import numpy as np

def normalize_points(x):
    mean = x.mean(axis=0)
    centered = x - mean
    scale = np.sqrt(2) / np.mean(np.linalg.norm(centered, axis=1))
    T = np.array([[scale, 0, -scale * mean[0]],
                  [0, scale, -scale * mean[1]],
                  [0, 0, 1]])
    xh = np.c_[x, np.ones(len(x))]
    xn = (T @ xh.T).T
    return xn, T

def eight_point(x1, x2):
    x1n, T1 = normalize_points(x1)
    x2n, T2 = normalize_points(x2)
    A = np.array([
        [b[0]*a[0], b[0]*a[1], b[0], b[1]*a[0], b[1]*a[1], b[1], a[0], a[1], 1]
        for a, b in zip(x1n, x2n)
    ])
    _, _, vt = np.linalg.svd(A)
    F = vt[-1].reshape(3, 3)
    u, s, vt = np.linalg.svd(F)
    s[-1] = 0
    F = u @ np.diag(s) @ vt
    return T2.T @ F @ T1
```

这段代码省略了 RANSAC，但保留了 normalized eight-point algorithm 的关键步骤。

## 7. 资料来源

本文对应 TUM Multiple View Geometry 课程 Chapter 5: **Reconstruction from Two Views: Linear Algorithms**, Prof. Daniel Cremers, Summer 2019。

> 📄 **A Computer Algorithm for Reconstructing a Scene from Two Projections**
> H. C. Longuet-Higgins. Nature 1981.
> Eight-point algorithm 的经典起点，用两个视图的点对应恢复相对运动。

## 结语

两视图重建的美感在于，它用一条共面约束绕开了三维点深度，把相机运动先从对应点里“滤”出来。SVD、null space、rank constraint、triangulation 在这里第一次真正合流。

但它也提醒我们：线性算法只是入口。噪声、退化、outliers、尺度不确定性都会让真实系统更复杂。好消息是，一旦你理解了 epipolar constraint，后面的多视图矩阵和 bundle adjustment 都会显得像这条主线的自然延伸。
