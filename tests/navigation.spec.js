import { test, expect } from '@playwright/test';
import { getBlogPosts } from '../scripts/blog-posts.js';

const blogPosts = getBlogPosts();
const samplePost = blogPosts.find((post) => post.slug === 'nn-classification') ?? blogPosts[0];
const desktopNavLinks = (page) => page.locator('nav .hidden.md\\:flex');

test.describe('Home page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('page loads with correct title', async ({ page }) => {
    await expect(page).toHaveTitle(/Douglas Li/);
  });

  test('all sections are visible', async ({ page }) => {
    await expect(page.locator('#home')).toBeVisible();
    await expect(page.locator('#about')).toBeVisible();
    await expect(page.locator('#skills')).toBeVisible();
    await expect(page.locator('#projects')).toBeVisible();
    await expect(page.locator('#blog')).toBeVisible();
    await expect(page.locator('#contact')).toBeVisible();
  });

  test('hero has 3 buttons', async ({ page }) => {
    const hero = page.locator('#home');
    const links = hero.locator('a');
    await expect(links).toHaveCount(3);
    await expect(links.nth(0)).toHaveText('查看项目');
  });

  test('click 阅读博客 goes to /blog', async ({ page }) => {
    const blogBtn = page.locator('#home a[href="/blog"]');
    await blogBtn.click();
    await expect(page).toHaveURL(/\/blog\/?$/);
    await expect(page.locator('h1')).toContainText('博客');
    for (const post of blogPosts) {
      await expect(page.locator(`a[href="${post.href}"]`)).toContainText(post.title);
    }
  });

  test('project cards open GitHub in new tab', async ({ page }) => {
    const cards = page.locator('#projects a[target="_blank"]');
    await expect(cards).toHaveCount(3);
    const firstHref = await cards.first().getAttribute('href');
    expect(firstHref).toContain('github.com/lidongyao95');
  });
});

test.describe('Navigation', () => {
  test('nav links work from home page', async ({ page }) => {
    await page.goto('/');

    // Check all nav links exist
    const nav = desktopNavLinks(page);
    await expect(page.locator('nav a[href="/"]').first()).toBeVisible();
    await expect(nav.locator('a[href="/#about"]')).toBeVisible();
    await expect(nav.locator('a[href="/#projects"]')).toBeVisible();
    await expect(nav.locator('a[href="/blog"]')).toBeVisible();
    await expect(nav.locator('a[href="/#contact"]')).toBeVisible();

    // Click 博客 → goes to /blog
    await nav.locator('a[href="/blog"]').click();
    await expect(page).toHaveURL(/\/blog\/?$/);
    await expect(page.locator('h1')).toContainText('博客');
  });

  test('nav links work from blog post page', async ({ page }) => {
    await page.goto(samplePost.href);

    // 首页 → goes to /
    await page.locator('nav a[href="/"]').first().click();
    await expect(page).toHaveURL('/');
    await expect(page.locator('#home')).toBeVisible();
  });

  test('nav 关于 link scrolls to about section', async ({ page }) => {
    await page.goto(samplePost.href);

    // Click 关于 from blog post → goes to /#about
    await desktopNavLinks(page).locator('a[href="/#about"]').click();
    await expect(page).toHaveURL('/#about');
    await expect(page.locator('#about')).toBeVisible();
  });

  test('nav 联系 link scrolls to contact section', async ({ page }) => {
    await page.goto('/');

    await desktopNavLinks(page).locator('a[href="/#contact"]').click();
    await expect(page).toHaveURL('/#contact');
    await expect(page.locator('#contact')).toBeVisible();
  });

  test('logo goes to home', async ({ page }) => {
    await page.goto(samplePost.href);
    await page.locator('nav a[href="/"]').first().click();
    await expect(page).toHaveURL('/');
  });
});

test.describe('Blog pages', () => {
  test('blog listing shows every content post', async ({ page }) => {
    await page.goto('/blog');
    const postLinks = page.locator('main a[href^="/blog/"]');
    await expect(postLinks).toHaveCount(blogPosts.length);
    for (const post of blogPosts) {
      await expect(page.locator(`a[href="${post.href}"]`)).toContainText(post.title);
    }
  });

  for (const post of blogPosts) {
    test(`${post.slug} renders title and back link`, async ({ page }) => {
      await page.goto(post.href);
      await expect(page.locator('h1')).toContainText(post.title);
      const backLink = page.locator('a[href="/blog"]').first();
      await expect(backLink).toBeVisible();
      await backLink.click();
      await expect(page).toHaveURL(/\/blog\/?$/);
    });
  }
});

test.describe('Blog knowledge graph', () => {
  test('filters the article list from graph node selections', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/blog');

    await expect(page.locator('[data-testid="knowledge-graph"] canvas')).toBeVisible();
    await expect(page.locator('[data-blog-item]:visible')).toHaveCount(blogPosts.length);

    const graphNodes = await page.locator('#graph-list-data').evaluate((el) => JSON.parse(el.textContent || '[]'));
    expect(graphNodes.some((node) => node.id === 'graphics-camera-model' && node.label === '线性相机模型')).toBe(true);
    expect(graphNodes.some((node) => node.id === 'graphics-simple-stereo' && node.label === 'Simple Stereo')).toBe(true);
    expect(graphNodes.some((node) => node.id === 'rag-system' && node.articleIds.length === 2)).toBe(true);

    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('knowledge-graph-select', {
        detail: { id: 'rag-system' },
      }));
    });
    await expect(page.locator('#blog-list-title')).toHaveText('RAG');
    await expect(page.locator('[data-blog-item]:visible')).toHaveCount(2);
    await expect(page.locator('[data-blog-item][data-article-id="rag-basics"]')).toBeVisible();
    await expect(page.locator('[data-blog-item][data-article-id="rag-engineering"]')).toBeVisible();

    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('knowledge-graph-select', {
        detail: { id: 'graphics-camera-model' },
      }));
    });
    await expect(page.locator('#blog-list-title')).toHaveText('线性相机模型');
    await expect(page.locator('[data-blog-item]:visible')).toHaveCount(1);
    await expect(page.locator('[data-blog-item][data-article-id="linear-camera-model-calibration"]')).toBeVisible();

    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('knowledge-graph-select', {
        detail: { id: 'graphics-simple-stereo' },
      }));
    });
    await expect(page.locator('#blog-list-title')).toHaveText('Simple Stereo');
    await expect(page.locator('[data-blog-item]:visible')).toHaveCount(1);
    await expect(page.locator('[data-blog-item][data-article-id="simple-stereo-vision"]')).toBeVisible();

    await page.locator('#blog-list-reset').click();
    await expect(page.locator('#blog-list-title')).toHaveText('时间倒序');
    await expect(page.locator('[data-blog-item]:visible')).toHaveCount(blogPosts.length);
  });
});

test.describe('External links', () => {
  test('all external links open in new tab', async ({ page }) => {
    await page.goto('/');
    const extLinks = page.locator('a[target="_blank"]');
    const count = await extLinks.count();
    expect(count).toBeGreaterThanOrEqual(3); // 3 GitHub projects

    for (let i = 0; i < count; i++) {
      const rel = await extLinks.nth(i).getAttribute('rel');
      expect(rel).toContain('noopener');
    }
  });
});

test.describe('Mobile responsiveness', () => {
  test('nav links hidden on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    // The nav links container should have the hidden class on mobile
    const navLinksContainer = page.locator('nav .hidden.md\\:flex');
    await expect(navLinksContainer).not.toBeVisible();
  });

  test('nav links visible on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');

    const navLinksContainer = page.locator('nav .hidden.md\\:flex');
    await expect(navLinksContainer).toBeVisible();
  });
});
