---
title: 'TUM MVG 9：变分方法如何把视觉问题写成能量最小化'
date: 2026-07-09
excerpt: '对应 TUM Multiple View Geometry Chapter 9，用图像平滑作为例子讲 variational methods、functional、Euler-Lagrange equation、gradient descent 与 edge-preserving regularization。'
group: 'graphics'
---

## 前言

有些视觉算法像菜谱：先滤波，再阈值，再做形态学，再补几个经验规则。变分方法的思路不一样，它先问一个更根本的问题：我们到底想要什么样的结果？

第九讲 **Variational Methods: A Short Intro** 是为第十讲变分多视图重建铺路。它用图像平滑作为小例子，解释如何把一个视觉任务写成能量函数，然后通过 Euler-Lagrange equation 或 gradient descent 求解。

你可以把变分方法想成“先写评分标准，再找最高分答案”。这和前面 BA、direct methods 的优化思想是一脉相承的。

## 1. Variational Methods 的基本姿态

### 1.1 从 heuristic pipeline 到 objective-first

课件强调，变分方法的优势在于先明确目标函数，而不是堆一串启发式步骤。

例如图像去噪，我们不只说“平滑一下”，而是写：

```text
结果应该接近观测图像
结果也应该足够平滑
```

这两句话可以变成一个 functional。

### 1.2 Functional 是函数的函数

普通函数吃一个数，吐一个数。Functional 吃一个函数，吐一个数：

$$
E(u)=\int_\Omega L(u,\nabla u,x)\,dx
$$

这里 $u$ 是我们要找的图像、深度图或形状函数。$E(u)$ 越小，说明这个候选结果越符合我们的建模偏好。

## 2. 图像平滑：一个最小但完整的例子

### 2.1 Data term 与 smoothness term

给定 noisy image $f$，我们想找 denoised image $u$。一个经典能量是：

$$
E(u)=\int_\Omega (u-f)^2 dx + \lambda \int_\Omega |\nabla u|^2 dx
$$

<figure>
  <img src="/images/tum-mvg-courseware/tum-mvg-09-p05.png" alt="TUM MVG Chapter 9 slide: variational image smoothing" />
  <figcaption>TUM MVG Chapter 9 截图：图像平滑的能量函数由 data term 和 smoothness term 组成。</figcaption>
</figure>

第一项要求 $u$ 不要离观测 $f$ 太远；第二项惩罚剧烈变化，让结果更平滑。

### 2.2 Lambda 是保真与平滑之间的旋钮

$\lambda$ 小，结果更贴近原图，噪声可能保留；$\lambda$ 大，结果更平滑，但细节可能被抹掉。

这和许多视觉问题的 trade-off 一样：我们总是在观测证据和先验偏好之间调旋钮。

## 3. Euler-Lagrange Equation：最优解必须满足的条件

### 3.1 从有限维梯度到函数梯度

在有限维优化里，最小值通常满足梯度为零。变分法里，对 functional 的最小化也有类似条件，即 Euler-Lagrange equation。

对于：

$$
E(u)=\int L(u,u')dx
$$

必要条件是：

$$
\frac{\partial L}{\partial u}
- \frac{d}{dx}\frac{\partial L}{\partial u'} = 0
$$

这条式子看起来抽象，但它只是“对函数求导后设为零”的连续版本。

### 3.2 平滑能量会导向扩散方程

对平方梯度平滑项求变分，会得到类似 Laplacian 的项。直觉上，像素会向邻居平均，尖锐噪声被扩散掉。

这解释了为什么很多图像平滑方法和 heat equation 有联系。

## 4. Gradient Descent：让图像沿能量下降

### 4.1 把求解看成时间演化

如果直接解 Euler-Lagrange equation 不方便，可以用 gradient descent：

$$
\frac{\partial u}{\partial t} = -\nabla E(u)
$$

从一个初值 $u(x,0)=f(x)$ 出发，让它沿能量下降方向慢慢演化。

<figure>
  <img src="/images/tum-mvg-courseware/tum-mvg-09-p09.png" alt="TUM MVG Chapter 9 slide: image smoothing by gradient descent" />
  <figcaption>TUM MVG Chapter 9 截图：gradient descent 可以逐步降低图像平滑能量。</figcaption>
</figure>

### 4.2 迭代不是魔法，是离散化的 PDE

在图像网格上，连续方程会被离散化成像素更新。每一步都很小，但很多步之后，图像会越来越符合能量函数的偏好。

这也是变分方法和数值计算紧密相连的原因：模型写得漂亮还不够，离散化和稳定性也很关键。

## 5. Edge-Preserving Smoothing：别把边缘当噪声

### 5.1 二次平滑会抹掉边缘

如果惩罚 $|\nabla u|^2$，大梯度会被强烈惩罚。图像边缘恰好也是大梯度，所以会被一起抹掉。

<figure>
  <img src="/images/tum-mvg-courseware/tum-mvg-09-p10.png" alt="TUM MVG Chapter 9 slide: discontinuity-preserving smoothing" />
  <figcaption>TUM MVG Chapter 9 截图：discontinuity-preserving smoothing 试图在降噪时保留图像边缘。</figcaption>
</figure>

### 5.2 Total Variation 的直觉

一种常见替代是 total variation：

$$
E(u)=\int_\Omega (u-f)^2dx+\lambda\int_\Omega |\nabla u|dx
$$

$|\nabla u|$ 对大梯度没有平方惩罚那么狠，因此更容易保留边缘。

这和后面形状重建里的 minimal surface、silhouette consistency 有精神联系：我们通过能量项表达自己想保护的结构。

## 6. 一个最小实践：一维去噪的梯度下降

### 6.1 离散化 data + smoothness

```python
import numpy as np

rng = np.random.default_rng(0)
f = np.sin(np.linspace(0, 2*np.pi, 50)) + 0.2 * rng.normal(size=50)
u = f.copy()
lam = 0.2
step = 0.1

for _ in range(200):
    lap = np.zeros_like(u)
    lap[1:-1] = u[:-2] - 2*u[1:-1] + u[2:]
    grad = 2 * (u - f) - 2 * lam * lap
    u -= step * grad

print("noisy first five:", np.round(f[:5], 3))
print("smooth first five:", np.round(u[:5], 3))
```

这段代码用离散 Laplacian 做平滑。它很小，但包含了变分方法的基本结构：定义能量，推导梯度，迭代下降。

### 6.2 离散化会改变问题性格

连续能量写在纸上很优雅，但真正计算时必须落到网格、差分和边界条件上。前向差分、后向差分、中心差分给出的数值行为并不完全一样；Neumann boundary 和 Dirichlet boundary 也会影响边缘附近的结果。

这就是为什么变分方法不是“推完 Euler-Lagrange 就结束”。推导只是建模的一半，另一半是数值求解。

### 6.3 Regularizer 是你对世界的偏见

平滑项不是中立的。二次梯度惩罚偏爱柔和变化，TV 偏爱分片平滑，曲率正则偏爱更圆润的边界。每一种 regularizer 都在悄悄告诉算法：“我相信世界大概长这样。”

这件事在三维重建里尤其重要。如果你偏爱平滑表面，薄结构可能被吃掉；如果你过度保边，噪声可能变成假结构。好的模型不是没有偏见，而是偏见和任务相称。

### 6.4 和深度学习 loss 的关系

今天训练神经网络时，我们也在写 energy，只是名字常叫 loss。Data term 可能是 photometric loss、depth loss、silhouette loss；regularizer 可能是 smoothness loss、normal consistency 或 eikonal loss。

从这个角度看，变分方法并没有过时。它提供的是一种建模语法：先说清楚什么叫好解，再决定用传统优化还是神经网络去近似这个好解。

### 6.5 一个阅读检查点

读完这一讲，可以试着把任意一个视觉任务拆成两项：data term 负责贴近观测，regularizer 负责表达先验。

如果你能为 stereo、optical flow、image denoising 和 shape reconstruction 分别写出这两项，变分方法的骨架就真正进入你的工具箱了。

这也是第十讲能从图像平滑自然跳到三维形状优化的原因。

## 7. 资料来源

本文对应 TUM Multiple View Geometry 课程 Chapter 9: **Variational Methods: A Short Intro**, Prof. Daniel Cremers, Summer 2019。

> 📄 **Nonlinear Total Variation Based Noise Removal Algorithms**
> Leonid Rudin, Stanley Osher, Emad Fatemi. Physica D 1992.
> TV denoising 的经典工作，把边缘保持平滑写成明确的变分优化问题。

## 结语

第九讲像是在给视觉算法换一种心态：不要急着堆步骤，先写清楚你要奖励什么、惩罚什么。Data term 让结果尊重观测，regularizer 让结果尊重先验，优化算法负责在二者之间找平衡。

这种心态会在第十讲变得更立体：当未知量不再是一张图像，而是三维形状本身，变分方法仍然可以把“多视图重建”写成一个能量最小化问题。换句话说，我们不是只在平滑图像，而是在为三维世界设计评分标准。
