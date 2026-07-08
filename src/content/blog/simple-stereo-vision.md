---
title: 'Simple Stereo：两台相机如何量出深度'
date: 2026-07-08
excerpt: '基于 First Principles of Computer Vision 的 Simple Stereo 视频与 Camera Calibration 讲义，拆解 baseline、disparity、triangulation、scan-line correspondence 与 stereo matching。'
group: 'graphics'
---

## 前言

你可以先做一个很日常的小实验：闭上一只眼，把手指伸到眼前，再轮流睁开左右眼。你会发现，手指好像在背景前来回跳动；手指越近，跳得越明显；手指越远，跳动越小。

这件小事就是 **Simple Stereo** 的直觉入口。

一台相机拍到一个像素点时，我们知道这条光线从相机中心出发，穿过图像平面上的某个位置，然后射向三维空间。但麻烦在于：这条射线上有无数个三维点，它们都会投到同一个像素。单张图像像是一张“缺少刻度的地图”，能告诉你方向，却不能告诉你距离。

两台相机放在一起，情况就变了。左相机给出一条射线，右相机也给出一条射线；如果我们知道这两个像素看的是同一个场景点，那么两条射线的交会位置就是三维点。这就是课程视频 [Simple Stereo | Camera Calibration](https://www.youtube.com/watch?v=hUVyDabn1Mg&list=PL2zRqk16wsdoCCLpou-dGo7QQNks1Ppzo&index=5) 和配套讲义里讲的核心思路。

如果说 [线性相机模型：把三维世界压到二维像素的一块矩阵](/blog/linear-camera-model-calibration) 回答的是“世界点如何变成像素”，那么这篇文章回答的是反方向的问题：当我们有两张像素图，能不能把深度找回来？

下面我们沿着一个很克制但很有用的设置来讲：两台相同且已经标定好的相机，右相机只相对左相机沿水平方向平移一段距离 $b$。这个距离叫 **baseline**。在这个简化设置里，深度会被压缩成一个非常漂亮的公式：

$$
z = \frac{f_x b}{d}
$$

其中 $d = u_1 - u_2$ 是左右图像中对应点的水平位移，也就是 **disparity**。

## 1. 一张图为什么不够

### 1.1 像素点不是三维点，而是一条射线

在线性相机模型里，一个三维点 $(x, y, z)$ 投影到像素 $(u, v)$，可以写成：

$$
u = f_x \frac{x}{z} + o_x
$$

$$
v = f_y \frac{y}{z} + o_y
$$

这里 $f_x, f_y$ 是用像素单位表示的焦距，$o_x, o_y$ 是 principal point。它们是相机内参的一部分。

如果你现在反过来，只知道像素坐标 $(u, v)$，并且相机已经标定好，那么可以整理得到：

$$
x = z \frac{u - o_x}{f_x}
$$

$$
y = z \frac{v - o_y}{f_y}
$$

注意这里的 $z$ 还不知道。

这说明什么？说明单个像素点反投影回三维空间，不会得到一个唯一的点，而会得到一整条射线。你可以把 $z$ 取成 1 米、2 米、10 米，都会得到这条射线上的一个候选三维点。

```text
single image pixel
        |
        v
camera center -----> outgoing ray -----> many possible 3D points
```

这就是单目深度为什么难。它不是计算步骤不够，而是信息本身少了一维。

### 1.2 标定相机能给方向，但不给距离

相机标定的价值在这里非常明显：如果没有内参，我们连这条射线的方向都不知道；有了内参，我们至少知道像素对应哪条 outgoing ray。

但这仍然不是深度。

这有点像你站在黑夜里看见远处一盏灯。你能说“它在那个方向”，却不能只靠一个观察位置判断它离你 5 米还是 50 米。要估距离，你需要移动一下自己，或者让另一个观察者站在旁边看同一盏灯。

Simple Stereo 做的就是后者。

## 2. Simple Stereo 的几何

### 2.1 两台相机给出两条射线

我们先把系统摆得非常规整：

- 左相机的光心作为世界坐标原点；
- 右相机和左相机完全相同；
- 右相机只沿水平 $x$ 方向平移 $b$；
- 两台相机的光轴平行；
- 失真暂时忽略，或者已经通过标定和校正处理掉。

这就是讲义里所谓的 simple stereo 或 simple binocular system。

![Simple Stereo 几何关系](/images/simple-stereo/stereo-geometry.svg)

设场景点为 $(x, y, z)$。它在左图像中的坐标是 $(u_1, v_1)$，在右图像中的坐标是 $(u_2, v_2)$。

对于左相机，我们有：

$$
u_1 = f_x \frac{x}{z} + o_x
$$

$$
v_1 = f_y \frac{y}{z} + o_y
$$

对于右相机，因为右相机向右平移了 $b$，同一个世界点在右相机坐标里横坐标变成 $x-b$，所以：

$$
u_2 = f_x \frac{x-b}{z} + o_x
$$

$$
v_2 = f_y \frac{y}{z} + o_y
$$

你会看到一个很关键的现象：在这个理想设置里，左右两张图的 $v$ 坐标相同，而 $u$ 坐标不同。

### 2.2 Disparity 从哪里来

把左右两个 $u$ 方程相减：

$$
u_1 - u_2
= f_x \frac{x}{z} + o_x - \left(f_x \frac{x-b}{z} + o_x\right)
$$

中间的 $x$ 和 $o_x$ 都抵消掉，只剩：

$$
u_1 - u_2 = \frac{f_x b}{z}
$$

我们把这个水平差值定义为 **disparity**：

$$
d = u_1 - u_2
$$

于是深度就是：

$$
z = \frac{f_x b}{d}
$$

这就是 Simple Stereo 最值得记住的一行公式。

它的直觉也很朴素：近处物体在左右眼之间“跳动”得更厉害，所以 disparity 大，深度小；远处物体几乎不跳，所以 disparity 小，深度大。

![Disparity 与深度的反比关系](/images/simple-stereo/disparity-depth.svg)

一旦 $z$ 有了，$x$ 和 $y$ 也可以从左相机的投影方程里恢复：

$$
x = \frac{(u_1 - o_x)z}{f_x}
$$

$$
y = \frac{(v_1 - o_y)z}{f_y}
$$

所以，Simple Stereo 的三维重建并不神秘。真正难的地方不是公式，而是我们如何知道左右图像里哪两个像素对应同一个三维点。

## 3. Baseline 是一把尺子

### 3.1 baseline 越大，深度刻度越敏感

公式 $z = f_x b / d$ 里，$b$ 是 baseline，也就是左右相机光心之间的距离。

从几何上看，baseline 像一把尺子的长度。尺子越长，同一个深度变化会造成越明显的 disparity 变化；尺子越短，远处物体的 disparity 很快就小到接近一个像素，深度估计会变得非常脆弱。

在离散图像里，我们只能测到有限精度的像素位置。假设 disparity 的误差是 $\Delta d$，深度误差大致会随着 $z^2$ 放大：

$$
\Delta z \approx \frac{z^2}{f_x b}\Delta d
$$

这解释了一个常见工程直觉：想测远一点，就需要更大的 baseline、更高的分辨率，或者更稳定的匹配。

### 3.2 baseline 也不是越大越好

不过，baseline 不是免费午餐。

如果两台相机离得太远，左右图像看见的内容差别会变大。有些区域左相机看得见，右相机看不见；有些表面因为视角变化而形变明显。这样虽然几何上 disparity 更大了，匹配却更难了。

这像两个人一起找同一本书的位置。两个人站得太近，视差不明显；站得太远，又可能一个人看见书脊，另一个人只能看见书页。工程里的 baseline 总是在“深度精度”和“匹配难度”之间折中。

## 4. Stereo Matching：真正麻烦的部分

### 4.1 对应点必须在同一条水平线上

在这个 simplified stereo 设定里，右相机只水平平移，所以左右图像中对应点的 vertical coordinate 相同：

$$
v_1 = v_2
$$

这件事非常重要。它把一个二维搜索问题变成了一维搜索问题。

也就是说，给定左图像里一个小窗口，我们不需要在右图像的整张图里找匹配窗口，只需要沿着同一条水平 scan line 往左或往右找。

![Scan-line correspondence](/images/simple-stereo/scanline-correspondence.svg)

这就是 **scan-line correspondence**。它让 Stereo Matching 从“在海里捞针”变成“在同一行里找最像的窗口”。

### 4.2 用小窗口做 template matching

假设左图像中有一个窗口 $W$，右图像中候选窗口相对它偏移 $(p, q)$。在 simple stereo 里通常 $q=0$，我们主要搜索水平偏移 $p$。

最直接的相似度是 SAD：

$$
\mathrm{SAD}(p) = \sum_{(i,j)\in W} |I_L(i,j) - I_R(i-p,j)|
$$

也可以用 SSD：

$$
\mathrm{SSD}(p) = \sum_{(i,j)\in W} (I_L(i,j) - I_R(i-p,j))^2
$$

SAD 和 SSD 都是“越小越像”。如果左右相机曝光、增益或暗角不完全一致，讲义里也提到可以用 normalized cross-correlation，也就是 NCC：

$$
\mathrm{NCC}(p)
= \frac{\sum_{(i,j)\in W} \tilde I_L(i,j)\tilde I_R(i-p,j)}
{\sqrt{\sum_{(i,j)\in W}\tilde I_L(i,j)^2}\sqrt{\sum_{(i,j)\in W}\tilde I_R(i-p,j)^2}}
$$

NCC 是“越大越像”，它更关心局部纹理形状，而不是绝对亮度。

![Simple Stereo pipeline](/images/simple-stereo/stereo-pipeline.svg)

### 4.3 窗口大小是一场取舍

窗口越小，定位越准，但纹理不够独特，容易匹配错。

窗口越大，匹配更稳，但边界会被抹平。比如前景物体和背景落在同一个窗口里，算法会被迫给这个窗口一个折中的 disparity，结果深度边界变模糊。

这就是经典 window-based stereo 的老问题：小窗口怕噪声，大窗口怕边界。讲义里提到 adaptive window 的思路，就是尝试多个窗口大小，然后为每个点选择匹配效果最好的窗口。

## 5. 用一小段代码把公式跑起来

### 5.1 从 disparity map 计算 depth map

先看最核心的部分：如果我们已经有 disparity map，深度图几乎是一行代码。

```python
import numpy as np


def disparity_to_depth(disparity, fx, baseline, min_disparity=1e-6):
    """Convert disparity in pixels to depth in meters."""
    disparity = np.asarray(disparity, dtype=np.float32)
    safe_disparity = np.maximum(disparity, min_disparity)
    return fx * baseline / safe_disparity


disparity = np.array([
    [4.0, 8.0, 16.0],
    [2.0, 6.0, 12.0],
], dtype=np.float32)

fx = 800.0        # pixels
baseline = 0.12  # meters

depth = disparity_to_depth(disparity, fx, baseline)
print(np.round(depth, 2))
```

输出会像这样：

```text
[[24. 12.  6.]
 [48. 16.  8.]]
```

同样的相机和 baseline 下，disparity 从 4 像素变成 16 像素，深度就从 24 米变成 6 米。这个反比关系非常直接。

### 5.2 一个最小 SAD 匹配器

下面这个代码片段做的是最朴素的 scan-line SAD matching。它不是生产级 stereo 算法，但能把讲义中的核心逻辑完整跑出来：对左图每个窗口，在右图同一行搜索若干候选 disparity，选 SAD 最小的那个。

```python
import numpy as np


def sad_disparity(left, right, max_disp=32, radius=2):
    left = np.asarray(left, dtype=np.float32)
    right = np.asarray(right, dtype=np.float32)
    h, w = left.shape
    disparity = np.zeros((h, w), dtype=np.float32)

    for y in range(radius, h - radius):
        for x in range(radius + max_disp, w - radius):
            template = left[y-radius:y+radius+1, x-radius:x+radius+1]
            best_disp = 0
            best_score = float("inf")

            for d in range(max_disp + 1):
                xr = x - d
                candidate = right[y-radius:y+radius+1, xr-radius:xr+radius+1]
                score = np.abs(template - candidate).sum()
                if score < best_score:
                    best_score = score
                    best_disp = d

            disparity[y, x] = best_disp

    return disparity


left = np.array([
    [0, 0, 0, 0, 0, 0, 0, 0],
    [0, 4, 5, 6, 7, 8, 0, 0],
    [0, 4, 9, 9, 9, 8, 0, 0],
    [0, 4, 5, 6, 7, 8, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0],
], dtype=np.float32)

right = np.roll(left, shift=-2, axis=1)

disp = sad_disparity(left, right, max_disp=3, radius=1)
print(disp)
```

这段代码故意保持简单，所以它没有处理遮挡、亚像素估计、边缘保护、代价聚合、左右一致性检查等工程细节。但它已经能说明一件事：Stereo Matching 的核心不是“神奇地理解场景”，而是在几何约束下做一个局部对应搜索。

## 6. Stereo Matching 为什么会失败

### 6.1 没有纹理，窗口都长得一样

如果你拍一张白纸，白纸内部每个小窗口都差不多。左图的一个白色窗口，在右图里会和许多白色窗口一样像。此时匹配没有足够的证据，disparity 就会变得不可靠。

这也是为什么很多主动深度系统会往场景里投射纹理。不是因为它们喜欢花哨图案，而是因为它们在给匹配问题增加可辨认的线索。

### 6.2 重复纹理会制造多个正确候选

如果场景是一排完全相同的栏杆，左图里的某个窗口可能在右图里匹配到多个位置。每个位置的 SAD 都差不多，但每个位置对应的深度完全不同。

这类错误在纯局部窗口方法里很常见。算法看见的是局部小块，它不知道你真正想匹配的是第几根栏杆。

### 6.3 Foreshortening 让左右窗口不再一样

还有一个更几何的问题：同一块三维表面，从左相机和右相机看，投影形状并不一定一样。除非这块表面刚好平行于两个图像平面，否则它在左右图中的小窗口会有不同程度的拉伸、压缩和形变。

这就是讲义里提到的 **foreshortening effect**。我们本来想拿一个方形窗口去匹配另一个方形窗口，但真实世界常常给我们两个已经变形的版本。

现代 stereo 方法会在代价聚合、全局优化、学习式匹配网络里处理这些问题；但无论方法多复杂，simple stereo 给出的几何骨架仍然是底层约束。

## 7. 把 Simple Stereo 放回视觉系统里

### 7.1 它不是完整系统，但它是核心骨架

真实 stereo pipeline 往往比这里复杂：

```text
camera calibration
        |
        v
image rectification
        |
        v
stereo matching
        |
        v
disparity map
        |
        v
depth map / point cloud
```

我们这篇文章故意站在 simplified setup 上，因为它能把最核心的因果链讲清楚：

```text
baseline b + focal length fx + disparity d
                 |
                 v
              depth z
```

### 7.2 为什么这对 AI/ML 读者也重要

如果你平时主要做 deep learning，很容易把深度估计看成一个端到端预测问题：输入图像，输出 depth map。

但几何告诉我们，模型不是在凭空发明深度。Stereo pair 里已经有非常强的物理约束：同一个三维点在左右图之间的位移，直接编码了深度。学习方法可以更鲁棒地找匹配、处理遮挡、补全无纹理区域，但它最好不要忘记 $z = f_x b / d$ 这个骨架。

这也是几何视觉和学习视觉最有趣的地方：一个提供硬约束，一个提供统计弹性。前者像尺子，后者像经验；真正在工程里好用的系统，往往需要两者握手。

## 结语

Simple Stereo 的美感在于，它把“深度”这件听起来很复杂的事，拆成了一个非常可操作的问题：先用两台标定相机制造视差，再用对应点的水平位移计算深度。

当然，公式只负责告诉我们“如果对应点已知，深度怎么来”。真正的工程难点是 stereo matching：无纹理、重复纹理、视角形变、窗口大小、遮挡和噪声都会把这个问题变得不干净。

但这不影响 Simple Stereo 成为理解三维视觉的一块基石。它提醒我们：图像不是孤立的像素矩阵，而是光线、几何和观测位置共同留下的痕迹。只要换一个观察位置，二维图像里就会悄悄露出第三维的线索。
