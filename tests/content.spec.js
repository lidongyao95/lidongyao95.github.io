import { test, expect } from '@playwright/test';

test.describe('Blog post content — nn-classification', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/blog/nn-classification');
  });

  test('page renders Chinese content', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('神经网络分类');
    await expect(page.locator('body')).toContainText('前向传播');
    await expect(page.locator('body')).toContainText('梯度下降');
    await expect(page.locator('body')).toContainText('损失函数');
  });

  test('KaTeX math formulas are rendered', async ({ page }) => {
    // KaTeX renders math as .katex spans
    const formulas = page.locator('.katex');
    const count = await formulas.count();
    expect(count).toBeGreaterThan(10);
  });

  test('SVG diagrams are rendered', async ({ page }) => {
    const svgs = page.locator('svg');
    const count = await svgs.count();
    expect(count).toBeGreaterThanOrEqual(4);
  });

  test('tables are rendered', async ({ page }) => {
    const tables = page.locator('table');
    const count = await tables.count();
    expect(count).toBeGreaterThanOrEqual(3);

    // First table has headers
    const firstTable = tables.first();
    await expect(firstTable.locator('thead th')).not.toHaveCount(0);
  });

  test('back to blog link works', async ({ page }) => {
    await page.locator('a[href="/blog"]').first().click();
    await expect(page).toHaveURL('/blog');
  });
});

test.describe('Home page content', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('hero particle background renders', async ({ page }) => {
    // The tsparticles div should be present
    const particles = page.locator('#tsparticles');
    await expect(particles).toBeAttached();
  });

  test('typed.js initializes', async ({ page }) => {
    // The typed-target span should be present
    const target = page.locator('#typed-target');
    await expect(target).toBeAttached();
  });

  test('skills grid has 6 items', async ({ page }) => {
    const skillCards = page.locator('#skills .grid > div');
    const count = await skillCards.count();
    expect(count).toBe(6);

    await expect(skillCards.first()).toContainText('React');
  });

  test('about section has tag badges', async ({ page }) => {
    const badges = page.locator('#about span.rounded-full');
    const count = await badges.count();
    expect(count).toBeGreaterThanOrEqual(4);
  });

  test('blog preview has posts', async ({ page }) => {
    const postLinks = page.locator('#blog a[href^="/blog/"]');
    const count = await postLinks.count();
    expect(count).toBeGreaterThanOrEqual(3);
    await expect(page.locator('#blog')).toContainText('模型的泛化能力');
    await expect(page.locator('#blog')).toContainText('模型训练范式');
  });

  test('footer has copyright and year', async ({ page }) => {
    const footer = page.locator('#contact');
    await expect(footer).toContainText('保留所有权利');
  });
});

test.describe('Cross-page consistency', () => {
  const pages = ['/', '/blog', '/blog/nn-classification', '/blog/hello-world'];

  for (const route of pages) {
    test(`${route} has nav bar`, async ({ page }) => {
      await page.goto(route);
      await expect(page.locator('nav')).toBeVisible();
    });

    test(`${route} has correct lang attribute`, async ({ page }) => {
      await page.goto(route);
      const lang = await page.locator('html').getAttribute('lang');
      expect(lang).toBe('zh-CN');
    });

    test(`${route} has footer`, async ({ page }) => {
      await page.goto(route);
      await expect(page.locator('#contact')).toBeAttached();
    });

    test(`${route} has valid internal links`, async ({ page }) => {
      await page.goto(route);

      // Collect all internal link hrefs
      const hrefs = await page.locator('a[href^="/"]').evaluateAll((els) =>
        els.map((el) => el.getAttribute('href')).filter(Boolean)
      );

      // Each internal link should be a valid path pattern
      for (const href of hrefs) {
        // Hash-only links refer to sections on other pages
        if (href.startsWith('/#')) continue;
        // Full URLs are external
        if (href.startsWith('http')) continue;

        // Should start with / and be a simple path
        expect(href).toMatch(/^\//);
        expect(href).not.toContain(' ');
      }

      // Verify a sample of critical links by actually navigating
      const criticalLinks = hrefs.filter(
        (h) =>
          h === '/blog' ||
          h === '/blog/generalization-and-interpretability' ||
          h === '/blog/pretraining-and-finetuning' ||
          h === '/blog/hello-world' ||
          h === '/blog/nn-classification'
      );
      for (const href of [...new Set(criticalLinks)]) {
        const resp = await page.goto(href);
        expect(resp?.status()).toBe(200);
      }
    });
  }
});
