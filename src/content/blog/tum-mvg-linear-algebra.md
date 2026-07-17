---
title: 'TUM MVG 1：多视图几何需要哪几块线性代数'
date: 2026-07-09
excerpt: '对应 TUM Multiple View Geometry Chapter 1，从向量空间、矩阵群、秩、特征值到 SVD，把后续相机运动与重建算法要用的线性代数工具先摆上桌。'
group: 'graphics'
---

## 前言

你可以把 Multiple View Geometry 想成一次很认真的拼图游戏：我们手里只有几张二维照片，却想拼回相机怎么动、点在哪里、线和面如何穿过空间。拼图碎片不是彩色纸片，而是向量、矩阵、零空间、秩约束和 SVD。

TUM 这套课件的第一讲没有急着讲相机，而是从 **Linear Algebra** 开始。这很像出门远行前先检查工具箱：螺丝刀、卷尺、水平仪都不耀眼，但真正拧螺丝的时候，少一个都难受。

本文对应 `/TUM_MVG_courseware/multiviewgeometry1.pdf`。我们会把这一讲压缩成一个面向视觉几何读者的“工具地图”：哪些概念会在后续反复出现，它们为什么不是抽象装饰，而是重建算法的骨架。

## 1. 向量空间：先约定我们在哪张纸上画图

### 1.1 Vector Space 不是公式癖，而是可计算的舞台

一个 **向量空间（vector space）** 最重要的直觉是：你可以在里面做两件事，加向量、乘标量，而且结果还留在这个空间里。

这听起来很平凡，但它给视觉几何提供了最基础的语言。二维图像点、三维空间点、相机位姿的小扰动、线性方程的解空间，都可以放在向量空间里讨论。

```text
image point residuals  -> R^2
3D landmarks           -> R^3
homogeneous points     -> P^2 / P^3
matrix parameters      -> R^(m x n)
```

一旦对象进入向量空间，我们就可以问：它们能不能线性组合？有没有基？维度是多少？哪些方向是不确定的？

### 1.2 Basis 像坐标系里的尺子

**基（basis）** 的作用有点像给房间铺上坐标网格。一个向量本身是“箭头”，但我们需要一组基向量来写出它的坐标。

如果 $B=\{b_1,\dots,b_n\}$ 是 $V$ 的一组基，那么任意 $v\in V$ 都能唯一写成：

$$
v = \sum_{i=1}^n \alpha_i b_i
$$

这件事在几何视觉里特别常见。比如相机坐标系和世界坐标系本质上就是两套 basis；所谓旋转，就是把同一个三维向量从一套正交基表达成另一套正交基。

## 2. 矩阵：线性变换的操作说明书

### 2.1 矩阵不是表格，而是函数

课件很快从 vector space 走到 **linear transformations and matrices**。如果你只把矩阵看成数字表格，后面会很累；更好的看法是：矩阵是一台把向量送到另一个向量的机器。

$$
L: V \rightarrow W,\quad y = A x
$$

在 MVG 里，这台机器可能是投影、旋转、坐标变换、线性约束，也可能是把很多观测堆成一个最小二乘系统。

### 2.2 Kronecker Product 是把约束摊平的胶带

课件里专门讲了 Kronecker product 和矩阵 stack。初看有点技术细节，但它在推导 eight-point algorithm 时会变得非常实用。

如果有一个双线性约束：

$$
x_2^\top E x_1 = 0
$$

我们希望把它改写成对 $E$ 的线性方程。把矩阵 $E$ 展平成向量 $e$ 后，可以得到类似：

$$
(x_1 \otimes x_2)^\top e = 0
$$

这就像把一张皱着的地图摊平，原来“点、矩阵、点”夹在一起的式子，变成了 $a^\top e=0$ 这样的线性方程。第五讲的 eight-point algorithm 基本就靠这个动作开门。

## 3. Matrix Groups：运动不是普通矩阵集合

### 3.1 GL、SL、O、SO 都在限制矩阵能做什么

课件随后列出一串 matrix groups：$GL(n)$、$SL(n)$、$O(n)$、$SO(n)$、$E(n)$。它们不是为了显得高级，而是在回答一个工程问题：哪些矩阵能代表我们关心的变换？

| 群 | 直觉 | 视觉几何里的角色 |
|---|---|---|
| $GL(n)$ | 可逆线性变换 | 坐标变换的一般形式 |
| $O(n)$ | 保长度的正交变换 | 镜像和旋转 |
| $SO(n)$ | 保长度、保方向的旋转 | 三维相机姿态 |
| $E(n)$ | 旋转加平移 | 刚体运动 |

当我们说相机姿态 $R\in SO(3)$，其实是在说：它必须满足 $R^\top R=I$ 且 $\det(R)=1$。这两个条件让旋转不会把物体拉长、压扁或翻面。

### 3.2 为什么不能随便优化一个 3x3 矩阵

如果你用普通梯度下降直接更新 $R$ 的 9 个元素，它很快就会离开 $SO(3)$。那时它看起来还是一个 $3\times 3$ 矩阵，却不再是合法旋转。

这就是第二讲要引入 Lie group / Lie algebra 的原因：我们需要既能做微小更新，又能留在合法运动空间里的参数化方式。

## 4. 秩、零空间与可解性

### 4.1 Rank 告诉我们观测有没有独立信息

**秩（rank）** 可以理解成一组方程真正提供了多少独立约束。很多重建问题看起来方程很多，但如果它们互相重复，实际信息量并不多。

例如一个线性系统：

$$
A x = 0
$$

如果 $A$ 的 null space 是一维，那 $x$ 只能确定到一个尺度；如果 null space 更大，说明还有更多不可观测自由度。

这在 homogeneous coordinates 里很自然。一个点或矩阵常常只确定到尺度：

$$
x \sim \lambda x,\quad \lambda\neq 0
$$

所以我们不总是追求唯一数值，而是追求“在 projective sense 下唯一”。

### 4.2 Null Space 是算法的出口

第五讲会把多对点对应写成：

$$
A e = 0
$$

然后用 SVD 找到 $A$ 最小奇异值对应的右奇异向量。这个向量就是在噪声意义下最接近满足所有 epipolar constraints 的 essential matrix 展平形式。

```python
import numpy as np

A = np.random.randn(12, 9)
_, _, vt = np.linalg.svd(A)
e = vt[-1]
E = e.reshape(3, 3)

print(E.shape)
print(np.linalg.norm(A @ e))
```

这段代码还没有视觉含义，但它已经展示了 MVG 中一个常见套路：把几何问题写成线性系统，再从 null space 里取解。

## 5. SVD：多视图几何的瑞士军刀

### 5.1 SVD 在分解什么

课件第一讲的重头戏是 **奇异值分解（Singular Value Decomposition, SVD）**：

$$
A = U \Sigma V^\top
$$

你可以把它想成一台机器的拆解图：$V^\top$ 先把输入坐标转到一组特殊轴上，$\Sigma$ 沿这些轴缩放，$U$ 再把结果转到输出空间。

<figure>
  <img src="/images/tum-mvg-courseware/tum-mvg-01-p27.png" alt="TUM MVG Chapter 1 slide: geometric interpretation of SVD" />
  <figcaption>TUM MVG Chapter 1 截图：SVD 的几何解释，把单位球变成沿奇异向量方向拉伸的椭球。</figcaption>
</figure>

这张图的直觉很重要：矩阵不是神秘数组，它会把空间里的球拉伸成椭球。奇异值就是各个主方向上的拉伸倍率。

### 5.2 最小二乘、低秩投影和伪逆

SVD 之所以在 MVG 里反复出现，是因为它能稳定处理三类问题：

| 问题 | SVD 的作用 |
|---|---|
| 找 $Ax=0$ 的非零解 | 取最小奇异值对应的 $v$ |
| 低秩约束 | 把小奇异值置零 |
| 伪逆 | 用非零奇异值的倒数组成 $A^+$ |

<figure>
  <img src="/images/tum-mvg-courseware/tum-mvg-01-p28.png" alt="TUM MVG Chapter 1 slide: Moore Penrose inverse" />
  <figcaption>TUM MVG Chapter 1 截图：Moore-Penrose inverse 是后续 least squares 和 reconstruction 的基础工具。</figcaption>
</figure>

eight-point algorithm 里，我们先线性估计 $E$，再把它投影回 essential matrix space。这个“投影回合法集合”的动作，本质上也要用 SVD。

## 6. 一个最小实践：用 SVD 拟合平面

### 6.1 从点云里找一个平面

假设我们有一堆三维点，想找最接近它们的平面。平面法向量就是点云中心化后协方差矩阵最小奇异值对应的方向。

```python
import numpy as np

points = np.array([
    [0.0, 0.0, 0.01],
    [1.0, 0.0, -0.02],
    [0.0, 1.0, 0.03],
    [1.0, 1.0, -0.01],
    [0.5, 0.2, 0.00],
])

centroid = points.mean(axis=0)
centered = points - centroid
_, _, vt = np.linalg.svd(centered)
normal = vt[-1]

print("centroid:", centroid)
print("normal:", normal)
print("residuals:", centered @ normal)
```

这和后面从图像约束里找 epipolar geometry 的味道很像：我们不是让每个观测都完美满足方程，而是在噪声中找一个总体最稳定的低维结构。

## 7. 资料来源

本文对应 TUM Multiple View Geometry 课程 Chapter 1: **Mathematical Background: Linear Algebra**, Prof. Daniel Cremers, Summer 2019。

## 结语

第一讲看起来像“预备知识”，但它其实已经把后面九讲的关键道具摆好了：向量空间给我们舞台，矩阵给我们变换，群给我们合法运动，秩和零空间告诉我们能不能解，SVD 则负责在噪声和约束之间搭桥。

所以读 MVG 的线代，不要像复习考试那样背定义。更好的方式是把每个概念都问一遍：它以后会帮我约束什么、分解什么、优化什么？一旦这个问题想通，线性代数就不再是前置门槛，而会变成你读几何推导时最可靠的同伴。
