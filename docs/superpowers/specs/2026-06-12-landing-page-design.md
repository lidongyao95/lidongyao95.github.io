# Landing Page Design Spec

## Overview

将 `lidongyao95.github.io` 改造为商用级个人 landing page，暗色科幻 + 现代极简混搭风格，包含完整的一页式板块和博客功能。

## Tech Stack

| 层级 | 选型 | 理由 |
|---|---|---|
| 框架 | Astro | 静态优先，完美适配 GitHub Pages，Content Collections 支持博客 |
| 样式 | Tailwind CSS | 暗色主题定制方便，生产构建 tree-shake |
| 交互组件 | React (Astro Islands) | tsParticles 通过 React 组件嵌入，仅在 Hero 区激活 |
| 粒子背景 | tsParticles | 成熟库，配置式使用，npm 安装 |
| 打字机效果 | typed.js | 轻量，几行初始化 |
| 博客 | Astro Content Collections (Markdown) | 构建时生成静态页面 |
| 部署 | GitHub Actions → gh-pages | 推送 master 自动构建部署 |

## Page Routes

- `/` — 单页 landing page（所有板块）
- `/blog` — 博客文章列表
- `/blog/[slug]` — 单篇文章详情

## Page Structure

### Navigation（固定顶部）
- 左侧 logo `<DL />`，霓虹绿色
- 右侧链接：Home / About / Projects / Blog / Contact（点击平滑滚动到对应板块）
- 滚动时导航栏背景加深（backdrop-blur）

### Hero（首屏）
- 全屏高度，深色渐变背景 `#0a0a1a → #0d1117`
- tsParticles 粒子连线作为背景层
- 标题 "Hi, I'm Douglas Li" 用 typed.js 打字机效果
- 副标题静态文字，CSS 渐入动画
- 两个 CTA 按钮："View Projects"（实心绿色） + "Get in Touch"（描边）
- 按钮 hover 时有光晕跟随鼠标效果（CSS）

### About Me
- 左右布局：左侧圆形头像占位，右侧个人介绍文字
- 下方展示几个关键技术栈标签（tag chips）
- 深色背景 `#0d1117`

### Tech Stack（技能展示）
- 居中标题
- 图标网格（6-8 个技术），卡片式布局
- 每个卡片：图标 + 技术名称，hover 时边框高亮
- 背景 `#0a0a0f`

### Featured Projects
- 居中标题
- 3 列卡片网格（移动端单列）
- 每张卡片：渐变封面图占位 + 项目名 + 简介 + 技术标签
- 卡片 hover：边框霓虹绿 + 微弱光晕 + 轻微上浮
- 背景 `#0d1117`

### Latest Blog Posts
- 居中标题
- 文章列表（3 篇最新）
- 每行：日期 + 标题，底部有分割线
- "View All Posts →" 链接跳转到 `/blog`
- 背景 `#0a0a0f`

### Footer / Contact
- "Let's Connect" 标题
- 社交图标链接：GitHub / LinkedIn / Twitter / Email
- 版权信息
- 背景 `#06060a`

## Color Palette

| 用途 | 色值 |
|---|---|
| 主背景（最深） | `#06060a` |
| 板块背景交替 | `#0a0a0f` / `#0d1117` |
| 强调色（霓虹绿） | `#00ff88` |
| 强调色变体 | `#00cc6a` |
| 文字主色 | `#ffffff` |
| 文字次要 | `#aaaaaa` |
| 文字三级 | `#666666` |
| 卡片/边框 | `rgba(255,255,255,0.06)` |

## Interactions

### 粒子背景（tsParticles）
- Hero 区背景，粒子连线网络
- 粒子颜色 `#00ff88` 及相关色
- 鼠标靠近粒子有轻微排斥反应
- React 组件，仅在 Hero 区域内激活

### 打字机效果（typed.js）
- Hero 标题逐字输出
- 打字速度 ~80ms/字，完成后光标闪烁
- 页面加载后自动开始

### 按钮光晕（CSS）
- 按钮 hover 时，一个径向渐变光斑跟随鼠标位置移动
- 使用 CSS `radial-gradient` + JS mousemove 更新坐标
- 不替换原生光标，仅在按钮/卡片上生效

### 板块入场动画
- Intersection Observer 监听板块进入视口
- 添加 CSS class 触发 `fade-in-up` 动画
- 每个板块只触发一次

## Non-Goals（不做）

- 自定义光标替换（改为 hover 光晕）
- 3D / Three.js 元素
- 视差滚动
- 页面过渡动画
- 暗色/亮色主题切换

## Deployment

```yaml
# .github/workflows/deploy.yml
触发条件：push to master
步骤：
  1. checkout
  2. setup Node.js
  3. npm install
  4. npm run build
  5. deploy to gh-pages branch (peaceiris/actions-gh-pages)
```

用户需在 GitHub 仓库 Settings → Pages 中：
- Source: Deploy from a branch
- Branch: `gh-pages` / `(root)`

## File Structure

```
/
├── .github/workflows/deploy.yml
├── public/
│   └── favicon.svg
├── src/
│   ├── components/
│   │   ├── Nav.astro
│   │   ├── Hero.astro
│   │   ├── ParticleBackground.jsx    # React island
│   │   ├── About.astro
│   │   ├── Skills.astro
│   │   ├── Projects.astro
│   │   ├── BlogPreview.astro
│   │   ├── Footer.astro
│   │   └── SectionWrapper.astro      # fade-in-up logic
│   ├── layouts/
│   │   ├── BaseLayout.astro
│   │   └── BlogPostLayout.astro
│   ├── pages/
│   │   ├── index.astro
│   │   ├── blog/
│   │   │   ├── index.astro
│   │   │   └── [slug].astro
│   ├── content/
│   │   └── blog/                     # Markdown posts
│   └── styles/
│       └── global.css
├── astro.config.mjs
├── tailwind.config.mjs
├── tsconfig.json
└── package.json
```
