---
title: 'TUM MVG 2：如何表示一个正在运动的三维场景'
date: 2026-07-09
excerpt: '对应 TUM Multiple View Geometry Chapter 2，从刚体运动、SO(3)、SE(3)、exponential map 到 camera motion，建立后续相机位姿估计的语言。'
group: 'graphics'
---

## 前言

想象你拿着手机绕着桌上的杯子拍视频。每一帧里，杯子的像素位置都在变；但杯子本身没有变形，真正变化的是相机和场景之间的相对位姿。

这就是第二讲 **Representing a Moving Scene** 的问题：我们该怎么描述一个三维物体或相机的运动？用三个角度？用一个 $3\times 3$ 矩阵？用旋转轴和角度？还是用 Lie group 里的 exponential coordinates？

如果第一讲是在准备线性代数工具，第二讲就是给“运动”这件事发身份证。没有这个身份证，后面的 two-view reconstruction、bundle adjustment、visual SLAM 都不知道该优化什么变量。

## 1. 3D Reconstruction 为什么一定会遇到运动表示

### 1.1 图像变了，不等于场景乱了

在多视图几何里，我们常常假设场景是静态的，而相机在运动。等价地，也可以认为相机不动，物体在做刚体运动。两种说法只差一个参考系。

课件一开始回顾 3D reconstruction 的起源：从多个二维视图恢复三维结构和相机运动。这里天然有两个未知量：

```text
structure: 3D points / lines / surfaces
motion:    relative camera pose between views
```

如果 motion 表示得不好，structure 也会跟着不稳定。

### 1.2 Rigid-body motion 保长度也保方向

**刚体运动（rigid-body motion）** 要保留物体内部的距离和朝向。也就是说，它不能把杯子拉成椭圆，不能把右手系翻成左手系。

最常见的表达是：

$$
X' = R X + T
$$

其中 $R\in SO(3)$ 是旋转，$T\in\mathbb{R}^3$ 是平移。

## 2. SO(3)：旋转不是任意 3x3 矩阵

### 2.1 SO(3) 的两个约束

三维旋转矩阵属于 **特殊正交群（Special Orthogonal Group）**：

$$
SO(3)=\{R\in\mathbb{R}^{3\times 3}\mid R^\top R=I,\det(R)=1\}
$$

第一个条件保证长度和夹角不变，第二个条件排除镜像翻转。

这就是为什么旋转优化有点别扭：它有 9 个矩阵元素，却只有 3 个自由度。你不能把它当普通 9 维向量随便加减。

### 2.2 Skew-symmetric matrix 是叉乘的矩阵马甲

课件从 cross product 走到 skew-symmetric matrices。给定 $\omega=(\omega_1,\omega_2,\omega_3)^\top$，定义：

$$
\hat{\omega}=
\begin{bmatrix}
0 & -\omega_3 & \omega_2\\
\omega_3 & 0 & -\omega_1\\
-\omega_2 & \omega_1 & 0
\end{bmatrix}
$$

那么：

$$
\hat{\omega}v = \omega \times v
$$

这个帽子操作 $\hat{\cdot}$ 很快会变成 exponential map 的入口。

## 3. Lie Group 与 Lie Algebra：在曲面上走小步

### 3.1 为什么需要 tangent space

你可以把 $SO(3)$ 想成嵌在九维空间里的三维弯曲曲面。旋转矩阵必须待在这张曲面上，但优化算法喜欢在平坦空间里加一个小增量。

Lie algebra 提供了一个很漂亮的折中：在当前姿态附近，我们用切空间里的小向量 $\omega$ 表示扰动；更新时再通过 exponential map 回到 $SO(3)$。

<figure>
  <img src="/images/tum-mvg-courseware/tum-mvg-02-p14.png" alt="TUM MVG Chapter 2 slide: schematic visualization of Lie group and Lie algebra" />
  <figcaption>TUM MVG Chapter 2 截图：Lie algebra 是 Lie group 在单位元附近的切空间，exponential map 把局部向量送回群上。</figcaption>
</figure>

这有点像在地球表面走路。你脚下的一小块地面可以近似成平面，但走完一步后，你仍然站在球面上。

### 3.2 Exponential map 与 Rodrigues 公式

对于旋转，exponential map 写作：

$$
R = \exp(\hat{\omega})
$$

如果 $\theta=\|\omega\|$，Rodrigues 公式给出：

$$
\exp(\hat{\omega}) =
I + \frac{\sin\theta}{\theta}\hat{\omega}
+ \frac{1-\cos\theta}{\theta^2}\hat{\omega}^2
$$

这条公式让“小旋转向量”变成合法旋转矩阵。它也是很多 SLAM 和 BA 实现里的基础更新方式。

## 4. SE(3)：旋转和平移一起走

### 4.1 刚体运动的矩阵形式

把 $R$ 和 $T$ 合在一起，我们得到：

$$
g =
\begin{bmatrix}
R & T\\
0 & 1
\end{bmatrix}
\in SE(3)
$$

三维点用齐次坐标表示后，刚体运动就是一次矩阵乘法：

$$
\tilde{X}' = g\tilde{X}
$$

这和相机投影链条特别契合，因为后面我们会频繁写出：

$$
\lambda x = K\Pi g X
$$

### 4.2 Twist 是 SE(3) 的局部速度

SE(3) 的 Lie algebra 通常用 twist 表示：

$$
\xi =
\begin{bmatrix}
v\\
\omega
\end{bmatrix}
\in\mathbb{R}^6
$$

其中 $\omega$ 是旋转速度，$v$ 是平移部分。它们一起描述刚体在当前瞬间的微小运动。

课件最后的 summary 表非常适合当速查表：

<figure>
  <img src="/images/tum-mvg-courseware/tum-mvg-02-p25.png" alt="TUM MVG Chapter 2 slide: summary of SO(3) and SE(3)" />
  <figcaption>TUM MVG Chapter 2 截图：SO(3) 与 SE(3) 的矩阵表示、指数表示、速度和 adjoint map 总结。</figcaption>
</figure>

## 5. Camera Motion：到底是谁相对谁在动

### 5.1 坐标系切换要小心方向

多视图几何里最容易踩坑的地方之一，是 $g$ 到底表示“相机到世界”还是“世界到相机”。同一个运动，方向反了，公式里就会出现逆矩阵。

一个实用习惯是给变换写清楚下标：

$$
X_c = R_{cw}X_w + T_{cw}
$$

这里 $cw$ 表示从 world 到 camera。读代码时也应该坚持这个约定，否则调试会变成猜谜。

### 5.2 连续帧运动是乘法，不是加法

两个刚体运动串起来，不是简单把 $R$ 和 $T$ 分别相加，而是群乘法：

$$
g_{03} = g_{23}g_{12}g_{01}
$$

这解释了为什么 pose graph optimization 里的误差通常写在群上，或者写在 Lie algebra 的 log space 里。

## 6. 一个最小实践：从旋转向量到旋转矩阵

### 6.1 用 Rodrigues 公式写一个 exp_so3

```python
import numpy as np

def hat(w):
    wx, wy, wz = w
    return np.array([
        [0, -wz, wy],
        [wz, 0, -wx],
        [-wy, wx, 0],
    ], dtype=float)

def exp_so3(w):
    theta = np.linalg.norm(w)
    W = hat(w)
    if theta < 1e-12:
        return np.eye(3) + W
    return (
        np.eye(3)
        + np.sin(theta) / theta * W
        + (1 - np.cos(theta)) / theta**2 * (W @ W)
    )

R = exp_so3(np.array([0.1, -0.2, 0.05]))
print(R)
print(R.T @ R)
print(np.linalg.det(R))
```

如果最后两行接近 $I$ 和 $1$，说明我们从局部向量更新后仍然留在了 $SO(3)$ 上。

## 7. 资料来源

本文对应 TUM Multiple View Geometry 课程 Chapter 2: **Representing a Moving Scene**, Prof. Daniel Cremers, Summer 2019。

## 结语

第二讲的核心不是“记住一堆群论符号”，而是建立一个非常工程化的直觉：相机运动住在一个有约束的空间里。我们既要尊重这个空间的几何结构，又要让优化算法能在局部做简单计算。

SO(3)、SE(3)、exponential map、twist，这些词看起来像数学门槛；但一旦你把它们看成“在合法运动空间里走小步”的工具，它们就会变得很亲切。后面的重建与 SLAM，本质上都是在这些小步之间寻找最能解释图像观测的那条路径。
