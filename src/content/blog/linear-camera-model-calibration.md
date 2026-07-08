---
title: '线性相机模型：把三维世界压到二维像素的一块矩阵'
date: 2026-07-08
excerpt: '基于 First Principles of Computer Vision 的 Linear Camera Model 视频，拆解相机标定中的 forward imaging model、homogeneous coordinates、intrinsic/extrinsic matrix 与 projection matrix。'
group: 'graphics'
---

## 前言

你可以先想象一个很普通的场景：桌上放着一个棋盘格立方体，相机咔嚓拍了一张照片。对人来说，这张照片很直观；但对计算机来说，照片里只剩下一堆像素坐标。

问题来了：如果现实世界里某个角点的三维坐标是 $(x_w, y_w, z_w)$，它为什么会落到图像里的某个像素 $(u, v)$？

这就是 Columbia University 的 First Principles of Computer Vision 课程视频 [Linear Camera Model | Camera Calibration](https://www.youtube.com/watch?v=qByYk6JggQU&list=PL2zRqk16wsdoCCLpou-dGo7QQNks1Ppzo&index=2) 试图回答的问题。视频的讲法很克制：不急着谈深度学习，也不急着谈 fancy reconstruction，而是先把相机这件事还原成一个基础映射：

$$
\text{3D world point} \longrightarrow \text{2D image pixel}
$$

这篇文章会沿着视频的路线，把这个映射拆成几块：世界坐标到相机坐标、透视投影、毫米坐标到像素坐标，最后把它们合并成一个 $3 \times 4$ 的 **投影矩阵（projection matrix）**。

如果你读过 [神经网络分类任务的底层原理](/blog/nn-classification)，那里我们关心的是“像素进了模型以后怎么变成类别”；这篇文章刚好往前追一步：像素还没进入模型之前，它是怎么由三维世界生成的。

说明一下：当前环境无法直接下载 YouTube 视频帧，因此文中的插图使用该视频配套 monograph 的同源截图。它们和视频内容一致，用来标出讲解中的关键画面。

## 1. 相机标定到底在标什么

### 1.1 从像素回到米、厘米、毫米

Computer Vision 里有很多任务只需要语义，不需要精确几何。比如分类一张图里有没有猫，模型只要输出一个标签就够了。

但机器人、AR、三维重建不一样。它们关心的是**度量空间（metric space）**：

```text
这个点离相机多远？
这两个角点之间实际相距多少厘米？
机器人应该往前走 30 cm，还是 3 m？
```

图像给我们的却只是像素：

```text
点 A 在第 56 列、第 115 行
点 B 在第 210 列、第 117 行
```

像素坐标本身没有物理单位。它像地图上的一个小点，你知道它在纸上的位置，但不知道现实中对应哪条街、哪栋楼、离你多远。

**相机标定（camera calibration）** 做的事，就是找出这张“地图”的比例尺、方向和摆放方式。

### 1.2 Internal 与 external 两组参数

视频一开始区分了两类参数：

**外参（extrinsic parameters）** 描述相机在世界里的位置和朝向。换句话说，相机坐标系 $\mathcal{C}$ 相对世界坐标系 $\mathcal{W}$ 是怎么平移、怎么旋转的。

**内参（intrinsic parameters）** 描述相机自己怎么成像。比如焦距是多少、像素在横纵方向的密度是多少、主点（principal point）落在哪里。

我们最终会把它们合成一条链：

```text
世界坐标 x_w
  -> 外参矩阵 M_ext
  -> 相机坐标 x_c
  -> 内参矩阵 M_int
  -> 齐次像素坐标 u~
  -> 普通像素坐标 (u, v)
```

这条链就是视频里的 **forward imaging model**。名字很准确：它描述的是从真实世界“向前”成像到图像平面的过程。

## 2. Forward Imaging Model：先把路径画出来

### 2.1 一个世界点，两个坐标系

视频里的第一张关键图，是一个三维点 $P$、一个世界坐标系 $\mathcal{W}$、一个相机坐标系 $\mathcal{C}$，以及相机的 image plane。

<figure>
  <img src="/images/linear-camera-model/forward-imaging-model.png" alt="Forward imaging model from 3D world coordinates to 2D image coordinates" />
  <figcaption>视频配套截图：forward imaging model 将世界坐标中的 3D 点映射到图像中的 2D 坐标。</figcaption>
</figure>

这张图里最重要的不是公式，而是顺序：

```text
1. 先把点 P 从世界坐标系 W 表达到相机坐标系 C
2. 再把相机坐标系里的 3D 点投影到 image plane
3. 最后把 image plane 上的物理坐标换成像素坐标
```

这就像你在城市里问路。别人说“向东走 100 米”，你得先知道自己面朝哪里；同样，一个世界点要被相机理解，也必须先转换到相机自己的坐标系。

### 2.2 透视投影的核心直觉

在 pinhole camera model 里，光线从三维点 $P$ 穿过相机中心，落到 image plane 上。这个过程会产生一个非常熟悉的现象：近大远小。

如果点在相机坐标系里的坐标是：

$$
\mathbf{x}_c =
\begin{bmatrix}
x_c \\
y_c \\
z_c
\end{bmatrix}
$$

焦距是 $f$，那么 image plane 上的物理坐标满足：

$$
x_i = f \frac{x_c}{z_c}
$$

$$
y_i = f \frac{y_c}{z_c}
$$

分母里的 $z_c$ 就是“深度”。同样的 $x_c$，如果点离相机越远，$z_c$ 越大，投影后的 $x_i$ 就越小。

所以，透视投影不是线性的。因为它有除法。

## 3. 从毫米到像素：内参的入口

### 3.1 Image plane 坐标还不是 pixel 坐标

刚才的 $x_i, y_i$ 还在 image plane 上，单位通常可以理解成毫米。但图像传感器读出来的是像素坐标 $(u, v)$。

这中间还差两个转换：

```text
毫米坐标 -> 像素密度缩放 -> 主点偏移 -> 像素坐标
```

<figure>
  <img src="/images/linear-camera-model/image-sensor-mapping.png" alt="Mapping image plane physical coordinates to pixel coordinates with focal lengths and principal point" />
  <figcaption>视频配套截图：像素密度、焦距与 principal point 一起构成相机的 intrinsic parameters。</figcaption>
</figure>

设 $m_x, m_y$ 是横纵方向每毫米对应多少像素。现实传感器的像素不一定是正方形，所以二者可以不同。再设主点坐标是 $(o_x, o_y)$，那么：

$$
u = m_x x_i + o_x
$$

$$
v = m_y y_i + o_y
$$

把 $x_i = f x_c / z_c$ 和 $y_i = f y_c / z_c$ 代进去：

$$
u = f_x \frac{x_c}{z_c} + o_x
$$

$$
v = f_y \frac{y_c}{z_c} + o_y
$$

其中：

$$
f_x = m_x f,\quad f_y = m_y f
$$

这四个量：

$$
(f_x, f_y, o_x, o_y)
$$

就是这个简化模型下的 **相机内参（intrinsic parameters）**。

### 3.2 为什么这还是一个麻烦模型

如果只是写公式，我们已经有从相机坐标到像素坐标的表达式了。可问题是，它仍然长这样：

$$
u = f_x \frac{x_c}{z_c} + o_x
$$

$$
v = f_y \frac{y_c}{z_c} + o_y
$$

这个形式不好估计，因为 $z_c$ 在分母里。你可以把它想成一个不太听话的齿轮箱：输入 $x_c, y_c, z_c$ 以后，不是简单地被矩阵乘一下，而是先除再加。

视频接下来做了一个很漂亮的动作：用 **齐次坐标（homogeneous coordinates）** 把这个非线性除法藏进尺度里。

## 4. Homogeneous Coordinates：把除法变成尺度

### 4.1 2D 点多加一维，为什么有用

一个普通的二维点是：

$$
\mathbf{u} =
\begin{bmatrix}
u \\
v
\end{bmatrix}
$$

它的齐次表示是：

$$
\tilde{\mathbf{u}} =
\begin{bmatrix}
u \\
v \\
1
\end{bmatrix}
$$

更一般地，下面这些向量都表示同一个像素点：

$$
\begin{bmatrix}
u \\
v \\
1
\end{bmatrix}
\equiv
\begin{bmatrix}
ku \\
kv \\
k
\end{bmatrix},\quad k \neq 0
$$

恢复普通坐标时，只要除以最后一维：

$$
u = \frac{\tilde{u}_1}{\tilde{u}_3},\quad
v = \frac{\tilde{u}_2}{\tilde{u}_3}
$$

这就是齐次坐标的魔法：它允许我们先用矩阵乘法得到一个“带尺度的点”，最后再统一做一次除法。

<figure>
  <img src="/images/linear-camera-model/homogeneous-projection.png" alt="Using homogeneous coordinates to express perspective projection as a linear matrix multiplication" />
  <figcaption>视频配套截图：齐次坐标把 perspective projection 写成一个 3×4 矩阵乘法。</figcaption>
</figure>

### 4.2 内参矩阵 K

在齐次坐标下，相机坐标点：

$$
\tilde{\mathbf{x}}_c =
\begin{bmatrix}
x_c \\
y_c \\
z_c \\
1
\end{bmatrix}
$$

可以通过一个矩阵映射到齐次像素坐标：

$$
\tilde{\mathbf{u}}
\equiv
\begin{bmatrix}
f_x & 0 & o_x & 0 \\
0 & f_y & o_y & 0 \\
0 & 0 & 1 & 0
\end{bmatrix}
\begin{bmatrix}
x_c \\
y_c \\
z_c \\
1
\end{bmatrix}
$$

左边这个 $3 \times 4$ 矩阵可以看成：

$$
M_{\text{int}} =
\begin{bmatrix}
K & \mathbf{0}
\end{bmatrix}
$$

其中 $K$ 是更常见的 calibration matrix：

$$
K =
\begin{bmatrix}
f_x & 0 & o_x \\
0 & f_y & o_y \\
0 & 0 & 1
\end{bmatrix}
$$

这一步很关键。原本的非线性透视投影，现在被写成了“矩阵乘法 + 齐次归一化”。

这和 [从 RNN 到 Linear Attention：一次完整的数学推导](/blog/rnn-to-linear-attention) 里那种“换一种表示，计算结构突然变简单”的味道有点像：不是世界变简单了，而是我们找到了更合适的坐标。

## 5. 外参矩阵：把世界搬到相机眼前

### 5.1 Rotation 与 translation

内参只负责“相机内部怎么投影”。但三维点一开始通常不在相机坐标系里，而是在世界坐标系里。

设世界坐标为：

$$
\mathbf{x}_w =
\begin{bmatrix}
x_w \\
y_w \\
z_w
\end{bmatrix}
$$

相机坐标为：

$$
\mathbf{x}_c =
\begin{bmatrix}
x_c \\
y_c \\
z_c
\end{bmatrix}
$$

世界到相机的刚体变换可以写成：

$$
\mathbf{x}_c = R\mathbf{x}_w + \mathbf{t}
$$

其中 $R$ 是 $3 \times 3$ 旋转矩阵，$\mathbf{t}$ 是平移向量。

这一步的直觉是：不是世界真的移动了，而是我们换了一个观察者。原来用“房间的坐标系”描述点，现在用“相机的坐标系”描述同一个点。

### 5.2 用齐次坐标合并成一个矩阵

同样，我们把它写成齐次形式：

$$
\tilde{\mathbf{x}}_c =
\begin{bmatrix}
R & \mathbf{t} \\
\mathbf{0}^\top & 1
\end{bmatrix}
\tilde{\mathbf{x}}_w
$$

这个 $4 \times 4$ 矩阵就是外参矩阵：

$$
M_{\text{ext}} =
\begin{bmatrix}
R & \mathbf{t} \\
\mathbf{0}^\top & 1
\end{bmatrix}
$$

如果你把相机想成一位摄影师，外参就是“摄影师站在哪里、朝哪里看”；内参就是“摄影师手里的镜头和传感器是什么样”。

## 6. Projection Matrix：一块矩阵走完整条链

### 6.1 内参与外参相乘

现在我们有两块拼图：

```text
M_ext: world -> camera
M_int: camera -> image
```

把它们相乘，就得到投影矩阵：

$$
P = M_{\text{int}} M_{\text{ext}}
$$

所以完整成像过程是：

$$
\tilde{\mathbf{u}} \equiv P\tilde{\mathbf{x}}_w
$$

其中：

$$
P \in \mathbb{R}^{3 \times 4}
$$

<figure>
  <img src="/images/linear-camera-model/projection-matrix.png" alt="Projection matrix combines intrinsic and extrinsic matrices for camera calibration" />
  <figcaption>视频配套截图：projection matrix 将 world-to-camera 与 camera-to-image 合成一个 3×4 线性模型。</figcaption>
</figure>

这就是“线性相机模型”的核心。

注意，这里的“线性”不是说最终像素坐标 $(u, v)$ 对三维点完全线性。齐次归一化那一步仍然有除法。真正的意思是：在齐次坐标空间里，投影可以由一个矩阵表示。

### 6.2 Projection matrix 的尺度不唯一

因为齐次坐标有尺度等价性：

$$
\tilde{\mathbf{u}} \equiv k\tilde{\mathbf{u}}
$$

所以投影矩阵也有尺度不唯一性：

$$
P \equiv kP,\quad k \neq 0
$$

这意味着，标定时我们不能指望恢复一个绝对尺度的 $P$。通常会通过约束来固定尺度，比如令 $\|p\| = 1$，或者让某个元素等于 1。

这不是 bug，而是投影几何本来的性质：如果把整个世界和相机一起等比例放大，图像可以完全不变。

## 7. 标定：用 3D-2D 对应点求 P

### 7.1 已知几何物体为什么有用

视频后半段开始进入 calibration procedure：拿一个已知尺寸的物体，比如带棋盘格的立方体，拍一张图。

我们知道一些角点在世界坐标系里的位置：

$$
(x_w^{(i)}, y_w^{(i)}, z_w^{(i)})
$$

也能在图像里找到对应像素：

$$
(u^{(i)}, v^{(i)})
$$

每一组对应关系都在告诉我们：投影矩阵 $P$ 应该把这个三维点送到这个二维像素附近。

### 7.2 每个点给两个线性方程

设：

$$
P =
\begin{bmatrix}
p_{11} & p_{12} & p_{13} & p_{14} \\
p_{21} & p_{22} & p_{23} & p_{24} \\
p_{31} & p_{32} & p_{33} & p_{34}
\end{bmatrix}
$$

对一个世界点：

$$
\tilde{\mathbf{x}} =
\begin{bmatrix}
x \\
y \\
z \\
1
\end{bmatrix}
$$

有：

$$
\tilde{\mathbf{u}} =
P\tilde{\mathbf{x}} =
\begin{bmatrix}
\alpha \\
\beta \\
\gamma
\end{bmatrix}
$$

普通像素坐标是：

$$
u = \frac{\alpha}{\gamma},\quad v = \frac{\beta}{\gamma}
$$

移项后，每个点提供两个关于 $P$ 元素的线性方程。把所有点堆起来，就得到：

$$
A\mathbf{p} = 0
$$

其中 $\mathbf{p}$ 是把 $P$ 的 12 个元素拉平成的向量。

### 7.3 最少需要多少点

$P$ 有 12 个元素，但因为尺度不唯一，实际自由度是 11。每个 3D-2D 对应点提供 2 个方程，所以理论上至少需要 6 个点。

实践里通常会用更多点，因为检测有噪声。更多点意味着我们解的是一个最小二乘问题：

$$
\min_{\|\mathbf{p}\|=1} \|A\mathbf{p}\|^2
$$

经典解法是 SVD：取 $A$ 最小奇异值对应的右奇异向量，reshape 成 $3 \times 4$ 的 $P$。

## 8. 实践：用 NumPy 求一个 Projection Matrix

下面是一个可以直接运行的 DLT（Direct Linear Transform）小片段。它不处理归一化、畸变和鲁棒估计，只展示视频里这条线性模型的骨架。

```python
import numpy as np


def estimate_projection_matrix(points_3d, points_2d):
    """
    points_3d: shape (N, 3), world coordinates
    points_2d: shape (N, 2), image pixel coordinates
    returns:   shape (3, 4), projection matrix up to scale
    """
    points_3d = np.asarray(points_3d, dtype=float)
    points_2d = np.asarray(points_2d, dtype=float)

    if points_3d.shape[0] < 6:
        raise ValueError("At least 6 3D-2D correspondences are required.")

    rows = []
    for (x, y, z), (u, v) in zip(points_3d, points_2d):
        X = np.array([x, y, z, 1.0])

        rows.append([*X, 0, 0, 0, 0, -u * x, -u * y, -u * z, -u])
        rows.append([0, 0, 0, 0, *X, -v * x, -v * y, -v * z, -v])

    A = np.asarray(rows)

    # Solve min ||A p|| subject to ||p|| = 1.
    _, _, vt = np.linalg.svd(A)
    p = vt[-1]
    P = p.reshape(3, 4)

    # Fix a convenient scale when possible.
    if abs(P[-1, -1]) > 1e-12:
        P = P / P[-1, -1]

    return P


def project_points(P, points_3d):
    points_3d = np.asarray(points_3d, dtype=float)
    ones = np.ones((points_3d.shape[0], 1))
    X_h = np.hstack([points_3d, ones])

    u_h = (P @ X_h.T).T
    return u_h[:, :2] / u_h[:, 2:3]
```

你可以把它想成一个“矩阵侦探”：给它一堆现实中的三维点和照片里的二维点，它反推出那块把三维世界压进二维图像的矩阵。

### 8.1 一个最小使用方式

```python
points_3d = np.array([
    [0, 0, 0],
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
    [1, 1, 0],
    [1, 0, 1],
    [0, 1, 1],
    [1, 1, 1],
])

points_2d = np.array([
    [120, 100],
    [220, 105],
    [118, 205],
    [150, 120],
    [218, 210],
    [250, 130],
    [145, 230],
    [248, 235],
])

P = estimate_projection_matrix(points_3d, points_2d)
reprojected = project_points(P, points_3d)

print(P)
print(np.mean(np.linalg.norm(reprojected - points_2d, axis=1)))
```

最后打印出来的平均误差，就是 re-projection error 的雏形。真实标定中，我们会更认真地做点归一化、畸变建模、非线性优化，以及异常点处理。

## 9. 这个模型的边界在哪里

### 9.1 它还没有处理 lens distortion

视频这一节讲的是 linear camera model，也就是 pinhole camera 的核心投影关系。真实镜头通常会有径向畸变和切向畸变，比如广角镜头边缘会弯。

所以工程里的 camera calibration 往往会在 $K, R, t$ 之外，再估计 distortion coefficients。

线性模型不是终点，它更像一个干净的骨架。先把骨架搭起来，再往上加真实镜头的复杂性。

### 9.2 它解释的是图像形成，不是图像理解

这篇文章讲的是“图像怎么来”。神经网络文章讲的是“图像来了以后怎么理解”。两者拼起来，才是一条完整链路：

```text
3D world
  -> camera projection
  -> pixels
  -> neural network
  -> class / depth / pose / action
```

如果只懂后半段，我们很容易把图像当成天然存在的矩阵；如果懂了前半段，就会意识到像素本身已经编码了相机姿态、焦距、深度和尺度的不确定性。

这也是为什么几何视觉和深度学习并不是互斥的。一个负责把世界结构讲清楚，一个负责从大量数据中学习难以手写的模式。

如果你想继续沿着几何方向往回走一步，看看两张标定图像如何把深度恢复出来，可以接着读 [Simple Stereo：两台相机如何量出深度](/blog/simple-stereo-vision)。那篇文章会把这里的单相机投影模型扩展成双目系统里的 baseline、disparity 和 triangulation。

## 10. 资料来源

这篇文章主要基于以下公开资料整理：

- Shree K. Nayar, **Linear Camera Model | Camera Calibration**, First Principles of Computer Vision, Columbia University, YouTube, 2025. [视频链接](https://www.youtube.com/watch?v=qByYk6JggQU&list=PL2zRqk16wsdoCCLpou-dGo7QQNks1Ppzo&index=2)
- Shree K. Nayar, **Camera Calibration**, Monograph FPCV-4-1, First Principles of Computer Vision, Columbia University, 2025. [PDF 链接](https://cave.cs.columbia.edu/Statics/monographs/Camera%20Calibration%20FPCV-4-1.pdf)

## 结语

线性相机模型最迷人的地方，是它把一件看似“光学、几何、传感器全搅在一起”的事情，压缩成了一块矩阵：

$$
\tilde{\mathbf{u}} \equiv P\tilde{\mathbf{x}}_w
$$

当然，这块矩阵不是魔法。它背后藏着相机站在哪里、朝哪里看，镜头焦距是多少，主点在哪里，世界点有多远。只是 homogeneous coordinates 给了我们一个足够优雅的语言，把这些因素放到同一个计算框架里。

所以，下一次你看到一张照片，不妨多想一层：那不是一块静态的像素布，而是三维世界穿过一个几何机器后留下的影子。Camera calibration 要做的，就是反过来读懂这台机器。
