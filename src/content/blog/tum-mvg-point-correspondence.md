---
title: 'TUM MVG 4：从像素亮度走到点对应'
date: 2026-07-09
excerpt: '对应 TUM Multiple View Geometry Chapter 4，讨论 photometry 到 geometry 的桥梁：small deformation、optical flow、Lucas-Kanade、feature extraction 与 wide-baseline matching。'
group: 'graphics'
---

## 前言

多视图几何有一个很现实的前提：你得知道两张图里哪些点对应同一个三维点。公式可以很优雅地写出 $x_2^\top E x_1=0$，但如果 $x_1$ 和 $x_2$ 根本不是同一个物体点，几何再漂亮也会崩。

第四讲 **Estimating Point Correspondence** 就是在补这座桥。前几讲讲的是点和线如何投影；这一讲提醒我们，图像里真正观测到的不是“点 ID”，而是亮度和颜色。

本文对应 `multiviewgeometry4.pdf`。我们会从 photometry 到 geometry，走过 optical flow、Lucas-Kanade、feature tracking 和 normalized cross correlation。

## 1. 从 Photometry 到 Geometry

### 1.1 图像给的是亮度，不是三维标签

相机给我们的原始数据是：

$$
I:\Omega\rightarrow \mathbb{R}
$$

也就是每个像素位置的亮度或颜色。几何算法想要的却是：

```text
point in image 1  <->  same 3D point in image 2
```

中间缺了一步：如何从局部亮度模式判断两个像素是否对应？

### 1.2 对应点是重建的门票

<figure>
  <img src="/images/tum-mvg-courseware/tum-mvg-04-p06.png" alt="TUM MVG Chapter 4 slide: identifying corresponding points" />
  <figcaption>TUM MVG Chapter 4 截图：找对应点是从图像亮度进入几何重建的关键步骤。</figcaption>
</figure>

你可以把对应点想成跨图像的“姓名牌”。没有姓名牌，我们只能看到一堆像素；有了姓名牌，才知道哪些观测应该被同一个三维变量解释。

## 2. Small Deformation：当运动很小，事情会简单很多

### 2.1 Brightness constancy assumption

Optical flow 的基础假设是亮度恒定：

$$
I(x + u(x), t+1) \approx I(x,t)
$$

如果位移很小，可以一阶展开：

$$
\nabla I(x)^\top u + I_t = 0
$$

这条式子给每个像素一个约束，但未知位移 $u=(u,v)$ 有两个分量，所以单个像素不够。

### 2.2 Aperture problem：只看局部会少一个方向

如果一个窗口里只有一条边，沿边方向移动时亮度几乎不变。算法只能确定垂直边的运动，确定不了沿边方向的运动。这就是 **aperture problem**。

这也是为什么角点比边缘更适合跟踪：角点在两个方向上都有亮度变化，局部结构张量更容易可逆。

## 3. Lucas-Kanade：用一个小窗口凑够约束

### 3.1 把邻域里的像素一起投票

Lucas-Kanade 方法假设一个小窗口里的所有像素共享同一个位移 $u$。于是我们最小化：

$$
E(u)=\int_W (I(x+u,t+1)-I(x,t))^2 dx
$$

一阶线性化后，会得到一个 $2\times 2$ 的 normal equation：

$$
M u = q
$$

<figure>
  <img src="/images/tum-mvg-courseware/tum-mvg-04-p11.png" alt="TUM MVG Chapter 4 slide: Lucas-Kanade method" />
  <figcaption>TUM MVG Chapter 4 截图：Lucas-Kanade 把 brightness constancy 线性化，得到局部位移的 least squares 问题。</figcaption>
</figure>

### 3.2 什么时候能估计 small motion

矩阵 $M$ 是否可逆，取决于窗口里的梯度分布。如果两个特征值都大，说明两个方向都有纹理，位移估计稳定；如果只有一个大，说明像边缘；如果都小，就是平坦区域。

这就是 Förstner / Harris 角点检测器背后的直觉：找那些“移动一点就明显不一样”的小窗口。

## 4. Wide Baseline：当视角差很大，局部平移不够用了

### 4.1 小运动假设会失效

视频相邻帧里，small deformation 还算合理。但两张相隔很远的照片之间，局部窗口可能发生尺度变化、旋转、仿射形变甚至遮挡。

这时我们不能只搜索一个小平移，而要用更鲁棒的描述子、尺度空间、仿射归一化，或者直接用 NCC 之类的相似度去比较候选 patch。

### 4.2 Normalized Cross Correlation 抵抗亮度变化

课件给出了 **normalized cross correlation (NCC)**。它把窗口减去均值、除以范数，因此对线性亮度变化更稳。

<figure>
  <img src="/images/tum-mvg-courseware/tum-mvg-04-p20.png" alt="TUM MVG Chapter 4 slide: normalized cross correlation" />
  <figcaption>TUM MVG Chapter 4 截图：NCC 用归一化后的相关性比较两个窗口，减轻亮度偏移和尺度变化的影响。</figcaption>
</figure>

直觉上，NCC 不问“两个窗口像素值是否一模一样”，而问“两个窗口的明暗起伏形状是否一致”。

## 5. 对应点错误会怎样污染几何

### 5.1 错一点，整条 epipolar geometry 都会偏

两视图重建通常会把很多对应点放进同一个系统里估计 $E$ 或 $F$。如果里面混入 outliers，它们会强行把模型往错误方向拉。

这也是 RANSAC 在传统视觉里如此常见的原因：先用随机小样本估模型，再让大多数内点投票。

### 5.2 学习方法也没有绕过对应问题

深度网络可以直接估 optical flow 或 matching cost volume，但它本质上仍在回答同一个问题：这两个图像局部是否对应同一个三维表面点？

区别只是手工特征变成了学习特征，局部相似度变成了网络估计的匹配代价。

## 6. 一个最小实践：Lucas-Kanade 的 2x2 系统

### 6.1 用梯度窗口估计平移

```python
import numpy as np

Ix = np.array([[1, 1, 0], [1, 2, 1], [0, 1, 1]], dtype=float)
Iy = np.array([[0, 1, 1], [1, 2, 1], [1, 1, 0]], dtype=float)
It = np.array([[-1, -1, 0], [-1, -2, -1], [0, -1, -1]], dtype=float)

A = np.stack([Ix.ravel(), Iy.ravel()], axis=1)
b = -It.ravel()
u, *_ = np.linalg.lstsq(A, b, rcond=None)

print("flow:", u)
print("structure tensor:", A.T @ A)
```

这段代码没有图像金字塔，也没有迭代 warp，但它保留了 Lucas-Kanade 的核心：用窗口里的梯度约束共同估计一个局部位移。

### 6.2 为什么真实 tracking 要用金字塔

Lucas-Kanade 的线性化假设要求位移足够小。如果点一下子移动了 20 个像素，一阶 Taylor expansion 往往已经不靠谱。图像金字塔的作用，就是先在低分辨率图像上把大位移变成小位移，再逐层细化。

```text
coarse image: estimate rough motion
      |
      v
finer image: refine residual motion
      |
      v
original image: final subpixel alignment
```

这和我们找路很像：先在地图上确定城市，再看街区，最后找门牌号。直接在原图里搜索，既慢又容易陷进局部错误。

### 6.3 Feature quality 比 feature count 更重要

很多初学实现会尽量提很多点，以为点越多越稳。实际上，低纹理区域、重复纹理区域和运动边界上的点，都会给后端几何带来麻烦。

好的 feature tracker 不只是“找点”，还要筛点：空间分布要均匀，局部结构要稳定，跟踪残差要合理，生命周期也要足够长。

如果一个点只活了一帧，它对多视图几何几乎没有帮助；如果一个点在十几帧里都稳定出现，它就像一枚小钉子，把相机轨迹牢牢钉在场景上。

### 6.4 和深度学习 optical flow 的关系

现代 optical flow 网络看起来和 Lucas-Kanade 很不一样，但底层问题没有变。网络学习的是更强的匹配表示、更大的搜索范围和更复杂的正则化；它仍然要解决遮挡、重复纹理、光照变化和边界不连续。

所以学习 Lucas-Kanade 并不是怀旧。它给你一个很小但清晰的实验台，让你看见 correspondence 问题里最基本的病灶。等你读 RAFT、FlowNet 或 deep stereo matching 时，这些病灶只是换了更大的身体。

### 6.5 一个阅读检查点

读完这一讲，可以用三个问题自测。

第一，brightness constancy 在什么情况下会失效？

第二，为什么角点比单纯边缘更适合 tracking？

第三，wide-baseline matching 为什么不能只靠小窗口平移？

如果这三个问题能答清楚，你就已经抓住了从 photometry 走向 geometry 的关键桥梁。

后面的重建算法都会默认这座桥已经搭好，所以这里值得多停一会儿。

## 7. 资料来源

本文对应 TUM Multiple View Geometry 课程 Chapter 4: **Estimating Point Correspondence**, Prof. Daniel Cremers, Summer 2019。

## 结语

第四讲的价值在于，它把几何从理想世界拉回图像现实。相机不会直接告诉你“这个像素来自三维点 42”，它只给你亮度。我们必须通过局部纹理、梯度、窗口相似度和特征检测，把 photometry 翻译成 geometry。

后面的 epipolar constraint、eight-point algorithm、bundle adjustment 都站在对应点之上。对应点越像一张干净的名单，几何推导就越顺；名单里混进错误身份，后面再精致的算法也只能努力补救。
