# Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a dark-themed commercial-grade personal landing page with particle background, typewriter effect, and blog support using Astro + Tailwind CSS.

**Architecture:** Astro static site with React islands for interactive components (tsParticles). Single-page landing with scroll-to-section navigation, plus separate blog routes. Deployed to GitHub Pages via GitHub Actions.

**Tech Stack:** Astro, Tailwind CSS, React (@astrojs/react), tsParticles (@tsparticles/react + @tsparticles/slim), typed.js, GitHub Actions

---

## File Structure

```
/
├── .github/workflows/deploy.yml
├── public/favicon.svg
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
│   │   └── Section.astro            # section wrapper with id + fade-in animation
│   ├── layouts/BaseLayout.astro
│   ├── pages/
│   │   ├── index.astro
│   │   └── blog/
│   │       ├── index.astro
│   │       └── [slug].astro
│   ├── content/
│   │   ├── config.ts
│   │   └── blog/
│   │       └── hello-world.md       # sample post
│   └── styles/global.css
├── astro.config.mjs
├── tailwind.config.mjs
├── tsconfig.json
└── package.json
```

---

### Task 1: Initialize Astro Project

**Files:**
- Create: `package.json`
- Create: `astro.config.mjs`
- Create: `tailwind.config.mjs`
- Create: `tsconfig.json`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "douglas-li-homepage",
  "type": "module",
  "version": "1.0.0",
  "scripts": {
    "dev": "astro dev",
    "start": "astro dev",
    "build": "astro build",
    "preview": "astro preview"
  }
}
```

- [ ] **Step 2: Install dependencies**

```bash
npm install astro @astrojs/react @astrojs/tailwind react react-dom tailwindcss @tsparticles/react @tsparticles/slim typed.js
```

- [ ] **Step 3: Create astro.config.mjs**

```js
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  integrations: [react(), tailwind()],
  site: 'https://lidongyao95.github.io',
  base: '/',
});
```

- [ ] **Step 4: Create tailwind.config.mjs**

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        accent: { DEFAULT: '#00ff88', dark: '#00cc6a' },
        bg: { darkest: '#06060a', dark: '#0a0a0f', medium: '#0d1117' },
      },
      fontFamily: { mono: ['JetBrains Mono', 'Fira Code', 'monospace'] },
    },
  },
  plugins: [],
};
```

- [ ] **Step 5: Create tsconfig.json**

```json
{
  "extends": "astro/tsconfigs/strict",
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "react"
  }
}
```

- [ ] **Step 6: Verify setup**

Run: `npx astro dev --host 0.0.0.0`
Expected: Dev server starts on localhost:4321 (no pages yet, will show 404)

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json astro.config.mjs tailwind.config.mjs tsconfig.json
git commit -m "feat: initialize Astro project with React and Tailwind"
```

---

### Task 2: Global Styles and Base Layout

**Files:**
- Create: `src/styles/global.css`
- Create: `src/layouts/BaseLayout.astro`

- [ ] **Step 1: Create global.css**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

html {
  scroll-behavior: smooth;
}

body {
  background-color: #06060a;
  color: #ffffff;
  overflow-x: hidden;
}

/* Fade-in-up animation */
.fade-in-up {
  opacity: 0;
  transform: translateY(30px);
  transition: opacity 0.6s ease-out, transform 0.6s ease-out;
}

.fade-in-up.visible {
  opacity: 1;
  transform: translateY(0);
}

/* Button glow effect */
.btn-glow {
  position: relative;
  overflow: hidden;
}

.btn-glow::after {
  content: '';
  position: absolute;
  top: var(--my, 50%);
  left: var(--mx, 50%);
  transform: translate(-50%, -50%);
  width: 300px;
  height: 300px;
  background: radial-gradient(circle, rgba(0, 255, 136, 0.12) 0%, transparent 70%);
  opacity: 0;
  transition: opacity 0.3s;
  pointer-events: none;
  border-radius: 50%;
}

.btn-glow:hover::after {
  opacity: 1;
}

/* Card glow for projects */
.card-glow {
  position: relative;
  overflow: hidden;
}

.card-glow::after {
  content: '';
  position: absolute;
  top: var(--my, 50%);
  left: var(--mx, 50%);
  transform: translate(-50%, -50%);
  width: 400px;
  height: 400px;
  background: radial-gradient(circle, rgba(0, 255, 136, 0.05) 0%, transparent 70%);
  opacity: 0;
  transition: opacity 0.3s;
  pointer-events: none;
  border-radius: 50%;
}

.card-glow:hover::after {
  opacity: 1;
}

/* Scrollbar styling */
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: #06060a; }
::-webkit-scrollbar-thumb { background: #1a1a2e; border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: #2a2a3e; }
```

- [ ] **Step 2: Create BaseLayout.astro**

```astro
---
---
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Douglas Li — Software Engineer</title>
    <meta name="description" content="A software engineer & lifelong learner." />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  </head>
  <body class="min-h-screen bg-bg-darkest text-white antialiased">
    <slot />

    <script>
      // Button & card glow effect — tracks mouse position
      document.querySelectorAll('.btn-glow, .card-glow').forEach((el) => {
        el.addEventListener('mousemove', (e) => {
          const rect = el.getBoundingClientRect();
          el.style.setProperty('--mx', `${e.clientX - rect.left}px`);
          el.style.setProperty('--my', `${e.clientY - rect.top}px`);
        });
      });

      // Fade-in-up on scroll via Intersection Observer
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add('visible');
            }
          });
        },
        { threshold: 0.1 },
      );

      document.querySelectorAll('.fade-in-up').forEach((el) => observer.observe(el));
    </script>
  </body>
</html>
```

- [ ] **Step 3: Commit**

```bash
git add src/styles/global.css src/layouts/BaseLayout.astro
git commit -m "feat: add global styles and base layout"
```

---

### Task 3: Navigation Component

**Files:**
- Create: `src/components/Nav.astro`

- [ ] **Step 1: Create Nav.astro**

```astro
---
const links = [
  { href: '#home', label: 'Home' },
  { href: '#about', label: 'About' },
  { href: '#projects', label: 'Projects' },
  { href: '#blog', label: 'Blog' },
  { href: '#contact', label: 'Contact' },
];
---

<nav class="fixed top-0 left-0 right-0 z-50 bg-bg-darkest/80 backdrop-blur-md border-b border-white/5">
  <div class="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
    <a href="#home" class="text-accent font-bold text-lg font-mono">&lt;DL /&gt;</a>
    <div class="hidden md:flex gap-8">
      {links.map((link) => (
        <a href={link.href} class="text-sm text-gray-400 hover:text-accent transition-colors">
          {link.label}
        </a>
      ))}
    </div>
  </div>
</nav>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/Nav.astro
git commit -m "feat: add navigation component"
```

---

### Task 4: Section Wrapper Component

**Files:**
- Create: `src/components/Section.astro`

- [ ] **Step 1: Create Section.astro**

```astro
---
const { id, bg = 'darkest' } = Astro.props;
const bgMap = {
  darkest: 'bg-bg-darkest',
  dark: 'bg-bg-dark',
  medium: 'bg-bg-medium',
};
---

<section id={id} class={`fade-in-up py-20 px-6 ${bgMap[bg] || bgMap.darkest}`}>
  <div class="max-w-6xl mx-auto">
    <slot />
  </div>
</section>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/Section.astro
git commit -m "feat: add section wrapper component with scroll animation"
```

---

### Task 5: Hero Section with Particles and Typewriter

**Files:**
- Create: `src/components/ParticleBackground.jsx`
- Create: `src/components/Hero.astro`

- [ ] **Step 1: Create ParticleBackground.jsx**

```jsx
import { useCallback } from 'react';
import Particles from '@tsparticles/react';
import { loadSlim } from '@tsparticles/slim';

export default function ParticleBackground() {
  const particlesInit = useCallback(async (engine) => {
    await loadSlim(engine);
  }, []);

  const options = {
    fullScreen: false,
    fpsLimit: 60,
    particles: {
      color: { value: '#00ff88' },
      links: {
        color: '#00ff88',
        distance: 150,
        enable: true,
        opacity: 0.12,
        width: 1,
      },
      move: {
        enable: true,
        speed: 0.8,
        direction: 'none',
        outModes: { default: 'bounce' },
      },
      number: {
        density: { enable: true, area: 800 },
        value: 50,
      },
      opacity: { value: 0.3 },
      size: { value: { min: 1, max: 3 } },
    },
    interactivity: {
      events: {
        onHover: { enable: true, mode: 'repulse' },
      },
      modes: {
        repulse: { distance: 100, duration: 0.4 },
      },
    },
    detectRetina: true,
  };

  return (
    <Particles
      id="tsparticles"
      init={particlesInit}
      options={options}
      className="!absolute inset-0"
    />
  );
}
```

- [ ] **Step 2: Create Hero.astro**

```astro
---
import ParticleBackground from './ParticleBackground';
---

<section id="home" class="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0a0a1a] via-bg-medium to-[#0a0a1a] overflow-hidden">
  <ParticleBackground client:load />

  <div class="relative z-10 text-center px-6 max-w-3xl">
    <p class="text-accent text-xs tracking-[0.3em] mb-8 uppercase animate-[fadeIn_1s_ease-out]">
      Software Engineer
    </p>

    <h1 class="text-4xl md:text-6xl font-bold mb-6 leading-tight">
      <span class="text-white">Hi, I'm </span>
      <span id="typed-target" class="text-accent"></span>
    </h1>

    <p class="text-gray-400 text-lg md:text-xl mb-10 max-w-xl mx-auto animate-[fadeIn_1s_ease-out_0.5s_both]">
      Building elegant solutions to complex problems
    </p>

    <div class="flex gap-4 justify-center flex-wrap animate-[fadeIn_1s_ease-out_1s_both]">
      <a href="#projects" class="btn-glow bg-accent text-bg-darkest px-7 py-3 rounded-lg font-semibold hover:bg-accent-dark transition-colors text-sm">
        View Projects
      </a>
      <a href="#contact" class="btn-glow border border-accent text-accent px-7 py-3 rounded-lg font-semibold hover:bg-accent/10 transition-colors text-sm">
        Get in Touch
      </a>
    </div>
  </div>
</section>

<style>
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
</style>

<script>
  import Typed from 'typed.js';

  const typed = new Typed('#typed-target', {
    strings: ["Douglas Li^1000 👋"],
    typeSpeed: 70,
    backSpeed: 30,
    backDelay: 1000,
    startDelay: 300,
    showCursor: true,
    cursorChar: '_',
    loop: false,
    onComplete: (self) => {
      self.cursor.style.animation = 'blink 1s step-end infinite';
    },
  });
</script>

<style is:global>
  #typed-target + .typed-cursor {
    color: #00ff88;
    font-weight: 300;
  }

  @keyframes blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0; }
  }
</style>
```

- [ ] **Step 3: Commit**

```bash
git add src/components/ParticleBackground.jsx src/components/Hero.astro
git commit -m "feat: add hero section with particle background and typewriter effect"
```

---

### Task 6: About Section

**Files:**
- Create: `src/components/About.astro`

- [ ] **Step 1: Create About.astro**

```astro
---
import Section from './Section.astro';
---

<Section id="about" bg="medium">
  <h2 class="text-3xl font-bold text-accent mb-12 text-center">About Me</h2>

  <div class="flex flex-col md:flex-row gap-10 items-center max-w-4xl mx-auto">
    <div class="w-44 h-44 rounded-full border-2 border-accent/20 flex-shrink-0 bg-bg-dark flex items-center justify-center">
      <span class="text-5xl">🧑‍💻</span>
    </div>

    <div>
      <p class="text-gray-400 leading-relaxed text-lg mb-6">
        A passionate software engineer who loves turning complex problems into simple,
        beautiful solutions. I specialize in building full-stack web applications
        with modern technologies.
      </p>
      <div class="flex flex-wrap gap-2">
        <span class="px-3 py-1.5 text-xs rounded-full border border-white/10 text-gray-300 bg-white/[0.02]">
          React
        </span>
        <span class="px-3 py-1.5 text-xs rounded-full border border-white/10 text-gray-300 bg-white/[0.02]">
          TypeScript
        </span>
        <span class="px-3 py-1.5 text-xs rounded-full border border-white/10 text-gray-300 bg-white/[0.02]">
          Node.js
        </span>
        <span class="px-3 py-1.5 text-xs rounded-full border border-white/10 text-gray-300 bg-white/[0.02]">
          Python
        </span>
        <span class="px-3 py-1.5 text-xs rounded-full border border-white/10 text-gray-300 bg-white/[0.02]">
          Docker
        </span>
        <span class="px-3 py-1.5 text-xs rounded-full border border-white/10 text-gray-300 bg-white/[0.02]">
          PostgreSQL
        </span>
      </div>
    </div>
  </div>
</Section>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/About.astro
git commit -m "feat: add about section"
```

---

### Task 7: Skills Section

**Files:**
- Create: `src/components/Skills.astro`

- [ ] **Step 1: Create Skills.astro**

```astro
---
import Section from './Section.astro';

const skills = [
  { name: 'React', icon: '⚛️' },
  { name: 'TypeScript', icon: '🟦' },
  { name: 'Node.js', icon: '🟢' },
  { name: 'Python', icon: '🐍' },
  { name: 'Docker', icon: '🐳' },
  { name: 'PostgreSQL', icon: '🗄️' },
];
---

<Section id="skills" bg="dark">
  <h2 class="text-3xl font-bold text-accent mb-12 text-center">Tech Stack</h2>

  <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 max-w-4xl mx-auto">
    {skills.map((skill) => (
      <div class="p-6 rounded-xl border border-white/5 bg-white/[0.02] text-center hover:border-accent/30 transition-all duration-300 group hover:-translate-y-0.5">
        <div class="text-3xl mb-3 group-hover:scale-110 transition-transform">
          {skill.icon}
        </div>
        <div class="text-sm text-gray-400 group-hover:text-gray-300 transition-colors">
          {skill.name}
        </div>
      </div>
    ))}
  </div>
</Section>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/Skills.astro
git commit -m "feat: add skills section"
```

---

### Task 8: Projects Section

**Files:**
- Create: `src/components/Projects.astro`

- [ ] **Step 1: Create Projects.astro**

```astro
---
import Section from './Section.astro';

const projects = [
  {
    title: 'Project One',
    description: 'A full-stack web application for real-time team collaboration.',
    tags: 'React · TypeScript · WebSocket',
    gradient: 'from-[#1a1a2e] to-[#16213e]',
  },
  {
    title: 'Project Two',
    description: 'CLI tool for automated deployment and CI/CD workflows.',
    tags: 'Python · Click · Docker',
    gradient: 'from-[#0f3460] to-[#16213e]',
  },
  {
    title: 'Project Three',
    description: 'Microservice architecture for high-throughput data processing.',
    tags: 'Node.js · Kafka · Redis',
    gradient: 'from-[#1a1a2e] to-[#0f3460]',
  },
];
---

<Section id="projects" bg="medium">
  <h2 class="text-3xl font-bold text-accent mb-12 text-center">Featured Projects</h2>

  <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
    {projects.map((project) => (
      <div class="card-glow rounded-xl border border-white/5 bg-white/[0.02] overflow-hidden hover:border-accent/20 hover:-translate-y-1 transition-all duration-300 group">
        <div class={`h-36 bg-gradient-to-br ${project.gradient} flex items-center justify-center`}>
          <span class="text-4xl opacity-30 group-hover:opacity-50 transition-opacity">📁</span>
        </div>
        <div class="p-5">
          <h3 class="font-semibold text-white mb-2 group-hover:text-accent transition-colors">
            {project.title}
          </h3>
          <p class="text-sm text-gray-500 mb-3 leading-relaxed">
            {project.description}
          </p>
          <span class="text-xs text-accent/80">{project.tags}</span>
        </div>
      </div>
    ))}
  </div>
</Section>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/Projects.astro
git commit -m "feat: add projects section"
```

---

### Task 9: Blog Preview Section

**Files:**
- Create: `src/components/BlogPreview.astro`

- [ ] **Step 1: Create BlogPreview.astro**

```astro
---
import Section from './Section.astro';

const posts = [
  { date: '2024-01-15', title: 'Understanding React Server Components', slug: 'react-server-components' },
  { date: '2024-01-08', title: 'Building a CLI Tool with Rust', slug: 'cli-tool-rust' },
  { date: '2023-12-20', title: 'System Design: Real-time Chat', slug: 'system-design-chat' },
];
---

<Section id="blog" bg="dark">
  <h2 class="text-3xl font-bold text-accent mb-12 text-center">Latest Posts</h2>

  <div class="max-w-3xl mx-auto">
    {posts.map((post) => (
      <a
        href={`/blog/${post.slug}`}
        class="block py-4 border-b border-white/5 hover:border-accent/20 transition-colors group"
      >
        <span class="text-xs text-gray-600">{post.date}</span>
        <h3 class="text-lg text-white group-hover:text-accent transition-colors mt-1">
          {post.title}
        </h3>
      </a>
    ))}
  </div>

  <div class="text-center mt-10">
    <a
      href="/blog"
      class="btn-glow inline-block border border-accent text-accent px-6 py-3 rounded-lg font-medium hover:bg-accent/10 transition-colors text-sm"
    >
      View All Posts &rarr;
    </a>
  </div>
</Section>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/BlogPreview.astro
git commit -m "feat: add blog preview section"
```

---

### Task 10: Footer / Contact Section

**Files:**
- Create: `src/components/Footer.astro`

- [ ] **Step 1: Create Footer.astro**

```astro
---
import Section from './Section.astro';

const socials = [
  { label: 'GitHub', icon: 'GH', href: 'https://github.com/lidongyao95' },
  { label: 'Email', icon: '📧', href: 'mailto:738401275@qq.com' },
];
---

<Section id="contact" bg="darkest">
  <div class="text-center border-t border-white/5 pt-16">
    <h2 class="text-3xl font-bold text-accent mb-4">Let's Connect</h2>
    <p class="text-gray-400 mb-10 max-w-md mx-auto">
      I'm always open to new opportunities and interesting projects.
    </p>

    <div class="flex justify-center gap-4 mb-10">
      {socials.map((s) => (
        <a
          href={s.href}
          target="_blank"
          rel="noopener noreferrer"
          class="w-11 h-11 rounded-full border border-white/10 flex items-center justify-center text-xs text-gray-400 hover:text-accent hover:border-accent/30 transition-all duration-300"
          aria-label={s.label}
        >
          {s.icon}
        </a>
      ))}
    </div>

    <p class="text-xs text-gray-600 pb-4">
      &copy; {new Date().getFullYear()} Douglas Li. All rights reserved.
    </p>
  </div>
</Section>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/Footer.astro
git commit -m "feat: add footer contact section"
```

---

### Task 11: Homepage Integration

**Files:**
- Create: `src/pages/index.astro`
- Create: `public/favicon.svg`

- [ ] **Step 1: Create favicon.svg**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="6" fill="#06060a"/>
  <text x="16" y="22" text-anchor="middle" font-family="monospace" font-size="18" font-weight="bold" fill="#00ff88">DL</text>
</svg>
```

Write to: `public/favicon.svg`

- [ ] **Step 2: Create index.astro**

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import Nav from '../components/Nav.astro';
import Hero from '../components/Hero.astro';
import About from '../components/About.astro';
import Skills from '../components/Skills.astro';
import Projects from '../components/Projects.astro';
import BlogPreview from '../components/BlogPreview.astro';
import Footer from '../components/Footer.astro';
---

<BaseLayout>
  <Nav />
  <main>
    <Hero />
    <About />
    <Skills />
    <Projects />
    <BlogPreview />
    <Footer />
  </main>
</BaseLayout>
```

- [ ] **Step 3: Verify homepage builds and runs**

Run: `npm run build`
Expected: Build succeeds. Check `dist/index.html` exists.

Run: `npm run dev`
Expected: Dev server starts, open http://localhost:4321 to see the full landing page.

- [ ] **Step 4: Commit**

```bash
git add src/pages/index.astro public/favicon.svg
git commit -m "feat: integrate homepage with all sections"
```

---

### Task 12: Blog Infrastructure and Pages

**Files:**
- Create: `src/content/config.ts`
- Create: `src/content/blog/hello-world.md`
- Create: `src/pages/blog/index.astro`
- Create: `src/pages/blog/[slug].astro`

- [ ] **Step 1: Create content config**

```ts
import { defineCollection, z } from 'astro:content';

const blog = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    date: z.date(),
    excerpt: z.string().optional(),
  }),
});

export const collections = { blog };
```

Write to: `src/content/config.ts`

- [ ] **Step 2: Create sample blog post**

```md
---
title: 'Hello, World!'
date: 2024-01-15
excerpt: 'Welcome to my blog. This is the first post.'
---

Welcome to my blog! This is where I'll share my thoughts on software engineering,
open source, and technology.

Stay tuned for more content.
```

Write to: `src/content/blog/hello-world.md`

- [ ] **Step 3: Create blog list page**

```astro
---
import BaseLayout from '../../layouts/BaseLayout.astro';
import Nav from '../../components/Nav.astro';
import Footer from '../../components/Footer.astro';
import { getCollection } from 'astro:content';

const posts = await getCollection('blog');
posts.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
---

<BaseLayout>
  <Nav />
  <main class="pt-28 pb-20 px-6">
    <div class="max-w-3xl mx-auto">
      <h1 class="text-4xl font-bold text-accent mb-4">Blog</h1>
      <p class="text-gray-500 mb-12">Thoughts on software engineering and technology.</p>

      {posts.length === 0 ? (
        <p class="text-gray-600">No posts yet. Check back soon!</p>
      ) : (
        posts.map((post) => (
          <a
            href={`/blog/${post.slug}`}
            class="block py-5 border-b border-white/5 hover:border-accent/20 transition-colors group"
          >
            <span class="text-xs text-gray-600">
              {post.data.date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </span>
            <h2 class="text-xl text-white group-hover:text-accent transition-colors mt-1">
              {post.data.title}
            </h2>
            {post.data.excerpt && (
              <p class="text-sm text-gray-500 mt-2">{post.data.excerpt}</p>
            )}
          </a>
        ))
      )}
    </div>
  </main>
  <Footer />
</BaseLayout>
```

Write to: `src/pages/blog/index.astro`

- [ ] **Step 4: Create blog post page**

```astro
---
import BaseLayout from '../../layouts/BaseLayout.astro';
import Nav from '../../components/Nav.astro';
import Footer from '../../components/Footer.astro';
import { getCollection } from 'astro:content';

export async function getStaticPaths() {
  const posts = await getCollection('blog');
  return posts.map((post) => ({
    params: { slug: post.slug },
    props: { post },
  }));
}

const { post } = Astro.props;
const { Content } = await post.render();
---

<BaseLayout>
  <Nav />
  <main class="pt-28 pb-20 px-6">
    <article class="max-w-3xl mx-auto">
      <a href="/blog" class="text-accent text-sm mb-8 inline-block hover:underline">
        &larr; Back to Blog
      </a>

      <span class="text-xs text-gray-600">
        {post.data.date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })}
      </span>

      <h1 class="text-4xl font-bold text-white mt-2 mb-8">
        {post.data.title}
      </h1>

      <div class="prose prose-invert max-w-none text-gray-400
        prose-headings:text-white prose-a:text-accent prose-strong:text-gray-200
        prose-code:text-accent prose-pre:bg-bg-dark prose-pre:border prose-pre:border-white/5">
        <Content />
      </div>
    </article>
  </main>
  <Footer />
</BaseLayout>
```

Write to: `src/pages/blog/[slug].astro`

- [ ] **Step 5: Verify blog builds**

Run: `npm run build`
Expected: Build succeeds. Check `dist/blog/index.html` and `dist/blog/hello-world/index.html` exist.

- [ ] **Step 6: Commit**

```bash
git add src/content/ src/pages/blog/
git commit -m "feat: add blog infrastructure with content collections"
```

---

### Task 13: GitHub Actions Deployment

**Files:**
- Create: `.github/workflows/deploy.yml`

- [ ] **Step 1: Create deploy workflow**

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [master]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build Astro
        run: npm run build

      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v4
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
```

Write to: `.github/workflows/deploy.yml`

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: add GitHub Actions deploy workflow"
```

---

### Task 14: Push and Configure GitHub Pages

- [ ] **Step 1: Push all commits to remote**

```bash
git push -u origin master
```

- [ ] **Step 2: Configure GitHub Pages**

Go to: `https://github.com/lidongyao95/lidongyao95.github.io/settings/pages`

Under "Build and deployment":
- Source: **GitHub Actions**

This is the only change needed — the workflow handles the rest. After the first push, GitHub Actions will build and deploy automatically. The site will be live at `https://lidongyao95.github.io`.

Wait for the Actions run to complete (check `https://github.com/lidongyao95/lidongyao95.github.io/actions`).

- [ ] **Step 3: Verify deployment**

Open: `https://lidongyao95.github.io`
Expected: Landing page loads with all sections, particle background animating, typewriter effect working.

---

### Task 15: Update README

**Files:**
- Create: `README.md`

- [ ] **Step 1: Create README**

```md
# Douglas Li — Personal Homepage

Built with [Astro](https://astro.build), [Tailwind CSS](https://tailwindcss.com), and deployed on GitHub Pages.

## Development

```bash
npm install
npm run dev        # Start dev server at localhost:4321
npm run build      # Build for production
npm run preview    # Preview production build
```

## Content

- Blog posts: `src/content/blog/` (Markdown files)
- Personal info: edit each component in `src/components/`
- Colors: `tailwind.config.mjs`
```

Write to: `README.md`

- [ ] **Step 2: Commit and push**

```bash
git add README.md
git commit -m "docs: add README with development instructions"
git push
```
