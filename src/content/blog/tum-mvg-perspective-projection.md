---
title: 'TUM MVG 3：透视投影如何把三维世界压成图像'
date: 2026-07-09
excerpt: '对应 TUM Multiple View Geometry Chapter 3，从艺术史里的透视直觉讲到 pinhole camera、intrinsic matrix、spherical projection、radial distortion 与 preimage/coimage。'
group: 'graphics'
---

## 前言

站在长走廊的一端，你会看到两侧墙线在远处汇聚；拿手机拍一排路灯，远处的灯会更密、更小。我们平时说这是“透视感”，在多视图几何里，它就是一个精确的映射：三维点穿过相机中心，落到二维图像平面。

第三讲 **Perspective Projection** 从艺术史讲起，再走到相机模型和投影矩阵。它和已有的 [线性相机模型](/blog/linear-camera-model-calibration) 是同一棵树上的两片叶子：前者更强调 projective geometry 的视角，后者更像 camera calibration 的工程入口。

本文对应 `multiviewgeometry3.pdf`。我们重点看四件事：pinhole projection、intrinsic matrix、畸变，以及 preimage/coimage。

## 1. 透视投影的直觉：近大远小不是错觉

### 1.1 艺术里的透视先于相机

课件前几页用绘画说明 perspective projection 的历史。画家很早就发现：如果想让平面画布看起来有深度，平行线不能总画成平行，它们要在消失点附近相遇。

这其实已经在使用 projective geometry 的思想：图像不是三维世界的等比例压扁，而是由一个观察中心诱导出来的投影。

### 1.2 数学模型里的相似三角形

最基础的 pinhole model 可以从相似三角形推出：

$$
x' = f\frac{X}{Z},\quad y' = f\frac{Y}{Z}
$$

<figure>
  <img src="/images/tum-mvg-courseware/tum-mvg-03-p09.png" alt="TUM MVG Chapter 3 slide: mathematics of perspective projection" />
  <figcaption>TUM MVG Chapter 3 截图：透视投影的相似三角形推导，深度 $Z$ 出现在分母里。</figcaption>
</figure>

分母里的 $Z$ 是所有故事的源头。同一个物体横向坐标 $X$ 不变，离相机越远，投影位置越靠近中心。

## 2. Homogeneous Coordinates：把除法藏进尺度

### 2.1 齐次坐标让投影变成矩阵乘法

普通坐标里，透视投影有除法，不是线性变换。但在 homogeneous coordinates 里，我们可以先写：

$$
\lambda x = K\Pi_0 X
$$

这里 $\lambda$ 吸收了深度尺度。最后从齐次坐标回到像素坐标时，再做一次归一化：

$$
u = \frac{\tilde{x}_1}{\tilde{x}_3},\quad
v = \frac{\tilde{x}_2}{\tilde{x}_3}
$$

这就像记账时先把所有金额放进同一张表，最后再统一换汇率。矩阵运算负责线性部分，尺度归一化负责透视除法。

### 2.2 Projective equivalence 是“同一条光线”

在 projective space 里：

$$
x \sim \alpha x,\quad \alpha\neq 0
$$

这些向量表示同一个图像点。视觉几何里很多量都只确定到尺度，比如 essential matrix、fundamental matrix、homography。这不是缺陷，而是投影几何的自然语言。

## 3. Intrinsic Matrix：相机自己的坐标习惯

### 3.1 从归一化平面到像素平面

pinhole projection 先得到归一化坐标，再由相机内参变成像素坐标：

$$
K =
\begin{bmatrix}
f_s & s & o_x\\
0 & f_y & o_y\\
0 & 0 & 1
\end{bmatrix}
$$

<figure>
  <img src="/images/tum-mvg-courseware/tum-mvg-03-p14.png" alt="TUM MVG Chapter 3 slide: intrinsic parameter matrix" />
  <figcaption>TUM MVG Chapter 3 截图：intrinsic matrix 把 normalized image coordinates 映射到 pixel coordinates。</figcaption>
</figure>

$f_s$ 和 $f_y$ 是像素单位下的焦距，$(o_x,o_y)$ 是 principal point，$s$ 是 skew。大多数现代相机 skew 接近 0，但公式保留它能让模型更一般。

### 3.2 Calibrated 与 uncalibrated 的差别

如果 $K$ 已知，我们可以把像素点归一化：

$$
\bar{x} = K^{-1}x
$$

这时几何关系可以直接写在 normalized coordinates 上。第五讲里，calibrated camera 对应 essential matrix；uncalibrated camera 则对应 fundamental matrix。

这不是名字区别，而是信息区别：知道 $K$ 等于你知道图像坐标如何对应相机光线。

## 4. Radial Distortion：真实镜头没那么理想

### 4.1 Pinhole camera 是骨架，不是完整身体

课件后面讲到 **radial distortion**。真实镜头尤其是广角镜头，会让直线变弯，边缘区域更明显。

常见模型把畸变写成半径的多项式：

$$
x_d = x(1+k_1r^2+k_2r^4+\cdots)
$$

$$
y_d = y(1+k_1r^2+k_2r^4+\cdots)
$$

其中 $r^2=x^2+y^2$。

### 4.2 为什么畸变要单独建模

如果你忽略畸变，后续的 epipolar line、triangulation、bundle adjustment 都会被系统误差污染。它不像随机噪声那样会互相抵消，而是稳定地把边缘点推错。

工程上常见做法是先 calibration 得到 distortion coefficients，再把图像点 undistort 到理想 pinhole model 下。

## 5. Preimage 与 Coimage：图像点背后的三维集合

### 5.1 一个像素对应一条射线

课件最后引入 **preimage** 和 **coimage**。如果图像中的一个点 $x$ 来自三维空间，那么所有能投到 $x$ 的三维点组成一条射线。

```text
image point x
      |
      v
camera center ---- ray ---- many possible 3D points
```

这就是为什么单张图像不能直接给深度：一个像素不是一个三维点，而是一条 possible world line。

### 5.2 一条图像线对应一个三维平面

类似地，图像里的一条线 $\ell$ 的 preimage 是穿过相机中心的一个三维平面。所有在这个平面上的三维点，投影后都会落在图像线 $\ell$ 上。

这组点/线的 preimage 直觉，会在第六讲多视图矩阵里变得非常关键。多张图像的 preimage 相交，才可能把三维结构钉住。

## 6. 一个最小实践：投影三维点

### 6.1 用 K[R|t] 得到像素坐标

```python
import numpy as np

K = np.array([
    [800, 0, 320],
    [0, 800, 240],
    [0, 0, 1],
], dtype=float)
R = np.eye(3)
t = np.array([[0.0], [0.0], [0.0]])
P = K @ np.hstack([R, t])

X = np.array([
    [0.0, 0.0, 4.0, 1.0],
    [1.0, 0.5, 4.0, 1.0],
    [-1.0, 0.2, 8.0, 1.0],
]).T

x_h = P @ X
x = (x_h[:2] / x_h[2]).T
print(x)
```

你可以改第三列的深度，会立刻看到投影点向主点收缩或远离。

### 6.2 调试投影代码时先看三件事

投影代码最常见的 bug，不一定出在矩阵乘法本身，而是出在坐标约定上。第一件事是确认 $Z_c$ 是否为正。如果大量点在相机后方，说明外参方向可能反了。

第二件事是确认像素坐标轴方向。数学推导里常把 $y$ 轴向上，但图像数组里 row index 通常向下增长。这个差异不会让公式错，却会让可视化上下颠倒。

第三件事是确认 $K$ 的单位。$f_x,f_y$ 应该是像素单位，不是毫米单位；如果你把物理焦距直接塞进去，投影点通常会聚在主点附近，像一张被压扁的照片。

这三个检查很朴素，却能排掉很多 camera model 实现里的低级错误。读课件时如果觉得公式都懂了，建议真的写一遍投影函数，再故意把 $R$ 取逆、把 $f$ 缩小、把 $Z$ 设成负数，看输出如何崩掉。几何直觉就是这样长出来的。

### 6.3 一个阅读检查点

读完这一讲，最好能把同一个三维点分别写成 world coordinates、camera coordinates、normalized image coordinates 和 pixel coordinates。只要这条链条顺了，后面的 epipolar geometry 就不会悬空。

如果这条链条里任意一环说不清，先回到投影函数做一次数值实验，通常比继续读公式更快。

## 7. 资料来源

本文对应 TUM Multiple View Geometry 课程 Chapter 3: **Perspective Projection**, Prof. Daniel Cremers, Summer 2019。

## 结语

透视投影最迷人的地方，是它把“看见”这件很日常的事变成了严肃的几何约束。近大远小、消失点、内参矩阵、径向畸变、preimage，它们看似分散，其实都在讲同一句话：图像不是世界的截图，而是从某个观察中心出发的投影。

当我们理解了这台投影机器，后面的对应点、epipolar constraint 和三维重建就不再像凭空变魔术。它们只是在反过来读这台机器留下的痕迹。
