---
title: 'TUM MVG 8：Direct Visual SLAM 为什么直接吃像素'
date: 2026-07-09
excerpt: '对应 TUM Multiple View Geometry Chapter 8，比较 feature-based 与 direct methods，梳理 photometric error、dense/semi-dense geometry、RGB-D tracking、loop closure 与 DSO。'
group: 'graphics'
---

## 前言

传统 SfM/SLAM 常像先做笔记再答题：先提取 feature points，匹配它们，再用这些稀疏点估相机运动和三维结构。Direct methods 的想法更像直接看原卷：不要只看被挑出来的特征点，尽量直接从图像亮度里估计运动和几何。

第八讲 **Direct Approaches to Visual SLAM** 正是在讲这个转向。它从 classical feature-based pipeline 的局限出发，走到 dense RGB-D tracking、loop closure、large-scale direct monocular SLAM 和 direct sparse odometry。

本文对应 `multiviewgeometry8.pdf`。我们重点关注 direct methods 的核心代价函数，以及它和第七讲 BA 的关系。

## 1. Feature-Based Pipeline 的长处和短板

### 1.1 传统管线的四步

课件总结 classical approaches 通常包含：

```text
extract feature points
match features across frames
estimate camera motion
triangulate / optimize structure
```

这条路线很成功，因为特征点稀疏、可解释、计算量较低，也容易配合 RANSAC 处理 outliers。

### 1.2 短板在于丢掉了太多像素

但从统计角度看，feature selection 会丢掉大量图像信息。许多像素虽然不是角点，却仍然包含几何线索。

<figure>
  <img src="/images/tum-mvg-courseware/tum-mvg-08-p06.png" alt="TUM MVG Chapter 8 slide: feature-based versus direct methods" />
  <figcaption>TUM MVG Chapter 8 截图：feature-based methods 先抽取匹配特征，direct methods 直接使用图像亮度误差。</figcaption>
</figure>

Direct methods 的主张是：如果相机运动和深度估计能直接解释图像亮度变化，那我们就不必把问题压缩成少数 keypoints。

## 2. Photometric Error：直接法的共同货币

### 2.1 Brightness constancy 再次登场

第四讲里，brightness constancy 用来估 optical flow。Direct SLAM 里，它变成相机位姿和深度的优化目标：

$$
E(g,h)=\sum_x \left| I_1(x)-I_2(\pi(g,h(x)x)) \right|
$$

其中 $g$ 是相机运动，$h(x)$ 是深度，$\pi$ 是投影函数。

这其实是 BA 的表亲。BA 最小化 feature reprojection error；direct methods 最小化 pixel photometric error。

### 2.2 Direct 不等于简单

直接吃像素听起来更自然，但代价也明显：

| 挑战 | 原因 |
|---|---|
| 光照变化 | brightness constancy 不再严格成立 |
| 非凸性 | 位姿和深度耦合，初值很重要 |
| 运动模糊 | 像素亮度被积分污染 |
| 遮挡 | 同一像素不一定来自同一表面 |

因此 direct methods 往往需要图像金字塔、鲁棒损失、曝光模型、关键帧策略和窗口优化。

## 3. Dense 与 Semi-Dense Geometry

### 3.1 Dense reconstruction 追求更多表面

课件早期 direct work 关注 realtime dense geometry。它希望从手持相机实时估计较稠密的深度图，而不是只有稀疏点云。

Dense 的吸引力很明显：机器人导航、AR、场景理解都更喜欢面和深度图，而不是漂在空中的少量点。

### 3.2 Semi-dense 是实用折中

纯 dense 计算量大，而且低纹理区域 photometric constraint 弱。Semi-dense 方法只在梯度明显的像素上优化，既保留较多结构，又避免平坦区域给优化添乱。

这也是 LSD-SLAM 一类方法的核心直觉：不是所有像素都同等有用，但也不必只保留少数角点。

## 4. Loop Closure 与全局一致性

### 4.1 局部 tracking 会积累漂移

Direct tracking 可以连续估计相机位姿，但长时间运行会累积 drift。你绕房间走一圈回到原处，系统可能以为你还差一点才闭合。

<figure>
  <img src="/images/tum-mvg-courseware/tum-mvg-08-p18.png" alt="TUM MVG Chapter 8 slide: pose graph optimization and loop closure" />
  <figcaption>TUM MVG Chapter 8 截图：loop closure 通过全局图优化修正长期漂移。</figcaption>
</figure>

Loop closure 就像日记里的回环证据：你发现“这里我来过”，于是要把之前整段路径重新拉齐。

### 4.2 Pose graph 是稀疏全局约束

当系统检测到回环，会在 pose graph 里添加一条约束。全局优化不一定重新优化所有像素，而是先在位姿图层面修正大尺度漂移。

这和第七讲 BA 的思想一致：把多个局部约束放进同一个优化问题，让整体更自洽。

## 5. Direct Sparse Odometry：直接法和稀疏性的握手

### 5.1 DSO 不追求每个像素

课件后面讲到 **Direct Sparse Odometry (DSO)**。它选择有信息量的稀疏像素点，但 residual 仍然是 photometric error，而不是 descriptor matching error。

<figure>
  <img src="/images/tum-mvg-courseware/tum-mvg-08-p31.png" alt="TUM MVG Chapter 8 slide: direct sparse odometry" />
  <figcaption>TUM MVG Chapter 8 截图：DSO 用稀疏但信息丰富的像素点做直接光度优化。</figcaption>
</figure>

这是一种很聪明的折中：保留 direct 的光度一致性，又避免 dense optimization 的计算压力。

### 5.2 Windowed joint optimization

DSO 使用滑动窗口联合优化多个关键帧的位姿、点的逆深度和光度参数。它像一个小型 BA，只是 residual 换成了 patch photometric error。

因此第七讲的 Gauss-Newton、Schur complement、稀疏 Hessian，在 direct methods 里仍然活跃。

## 6. 一个最小实践：一维 photometric alignment

### 6.1 用亮度误差估平移

```python
import numpy as np

signal = np.array([0, 0, 1, 2, 4, 2, 1, 0, 0], dtype=float)
shifted = np.array([0, 1, 2, 4, 2, 1, 0, 0, 0], dtype=float)

def sad_at_shift(a, b, shift):
    if shift >= 0:
        return np.sum(np.abs(a[shift:] - b[:len(b)-shift]))
    return np.sum(np.abs(a[:len(a)+shift] - b[-shift:]))

scores = {s: sad_at_shift(signal, shifted, s) for s in range(-3, 4)}
print(scores)
print("best shift:", min(scores, key=scores.get))
```

真实 direct SLAM 会在连续位姿空间里优化，而不是枚举整数平移。但这个小例子保留了核心问题：找一个几何变换，让两次观测的亮度尽量对齐。

### 6.2 Photometric calibration 不是可有可无

Direct methods 对亮度很敏感，所以相机响应函数、曝光时间、vignetting 都会影响误差模型。如果两张图的亮度变化来自自动曝光，而不是几何运动，优化器就会试图用错误的位姿去解释光照变化。

这就是为什么 DSO 一类系统会显式建模 affine brightness transfer：

$$
I_j \approx a I_i + b
$$

它承认亮度不是完全恒定的，但希望通过少量参数把非几何变化吸收掉。

### 6.3 为什么初值如此重要

Photometric error landscape 通常很崎岖。相机位姿稍微偏得太远，投影点就会落到完全不同的图像区域，梯度方向也不再指向正确解。

所以 direct SLAM 往往依赖 coarse-to-fine tracking、constant velocity model、IMU prior 或上一帧 pose 作为初值。它不是在全局搜索正确相机位姿，而是在一个合理初值附近做精细对齐。

### 6.4 Direct 与 feature-based 可以混合

很多系统并不严格站队。可以用 feature matching 做 relocalization 和 loop closure，用 direct alignment 做短期 tracking；也可以用特征点提供稀疏几何骨架，再用 direct residual 增强局部精度。

工程系统的目标不是证明某个范式更纯粹，而是在速度、鲁棒性、精度和场景适应性之间做折中。

### 6.5 读第八讲时抓住一条线

这一讲材料很多，从 dense RGB-D 到 DSO，容易读散。建议抓住一条主线：

```text
feature residual
      |
      v
photometric residual
      |
      v
windowed nonlinear optimization
      |
      v
global consistency via loop closure
```

只要这条线没丢，具体系统的差别就比较容易归位：有的更 dense，有的更 sparse；有的依赖 RGB-D，有的只用 monocular；有的重 tracking，有的重 mapping。

读系统论文时，先问 residual 是什么，再问优化窗口是什么，通常比先记模块名更有效。

## 7. 资料来源

本文对应 TUM Multiple View Geometry 课程 Chapter 8: **Direct Approaches to Visual SLAM**, Prof. Daniel Cremers, Summer 2019。

> 📄 **Direct Sparse Odometry**
> Jakob Engel, Vladlen Koltun, Daniel Cremers. TPAMI 2018. arXiv:1607.02565.
> 用稀疏高信息像素和滑动窗口光度优化构建高精度 direct visual odometry。

## 结语

Direct Visual SLAM 的关键转向，是把“特征点是几何入口”改成“像素亮度本身就是几何证据”。它不是要否定 feature-based methods，而是在另一条路线上挖掘图像信息。

这条路的代价是优化更敏感、假设更脆弱、工程更复杂；收益是能够利用更多像素，得到更密的几何，并在纹理和光度模型处理得当时达到很高精度。读完第八讲，你会发现 direct 和 feature-based 并不是宗教对立，它们只是对“哪些图像信息值得相信”给出了不同答案。
