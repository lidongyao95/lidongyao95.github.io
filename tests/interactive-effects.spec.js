import { test, expect } from '@playwright/test';

test.describe('Interactive visual effects', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
  });

  test('custom cursor and neural trail respond to pointer movement', async ({ page }) => {
    await page.mouse.move(120, 160);
    await page.mouse.move(360, 240, { steps: 10 });

    await expect(page.locator('html')).toHaveClass(/has-interactive-cursor/);
    await expect(page.locator('[data-cursor-orb]')).toBeAttached();
    await expect(page.locator('[data-cursor-ring]')).toBeAttached();

    const pointerVars = await page.evaluate(() => ({
      x: document.documentElement.style.getPropertyValue('--pointer-x'),
      y: document.documentElement.style.getPropertyValue('--pointer-y'),
    }));

    expect(pointerVars.x).toBe('360px');
    expect(pointerVars.y).toBe('240px');

    await page.waitForFunction(() => document.querySelectorAll('.neural-trail-node').length > 0);
    const trailNodes = await page.locator('.neural-trail-node').count();
    expect(trailNodes).toBeGreaterThan(0);
  });

  test('hero particle signal layer renders with three sweep lines', async ({ page }) => {
    const signalField = page.locator('[data-particle-signal]');

    await expect(signalField).toBeAttached();
    await expect(signalField.locator('.particle-signal')).toHaveCount(3);
  });

  test('hero buttons expose magnetic movement variables', async ({ page }) => {
    const button = page.locator('#home .btn-glow').first();
    const box = await button.boundingBox();

    expect(box).not.toBeNull();
    await page.mouse.move(box.x + box.width - 4, box.y + box.height / 2);

    const magnetVars = await button.evaluate((el) => ({
      x: el.style.getPropertyValue('--magnet-x'),
      y: el.style.getPropertyValue('--magnet-y'),
    }));

    expect(magnetVars.x).toMatch(/px$/);
    expect(magnetVars.x).not.toBe('0px');
    expect(magnetVars.y).toMatch(/px$/);
  });

  test('project cards tilt from pointer position and reset on leave', async ({ page }) => {
    const card = page.locator('[data-tilt-card]').first();
    await card.scrollIntoViewIfNeeded();

    const box = await card.boundingBox();
    expect(box).not.toBeNull();

    await page.mouse.move(box.x + box.width * 0.78, box.y + box.height * 0.22, { steps: 8 });

    const activeVars = await card.evaluate((el) => ({
      mx: el.style.getPropertyValue('--mx'),
      my: el.style.getPropertyValue('--my'),
      tiltX: el.style.getPropertyValue('--tilt-x'),
      tiltY: el.style.getPropertyValue('--tilt-y'),
    }));

    expect(activeVars.mx).toMatch(/px$/);
    expect(activeVars.my).toMatch(/px$/);
    expect(activeVars.tiltX).toMatch(/deg$/);
    expect(activeVars.tiltY).toMatch(/deg$/);
    expect(activeVars.tiltX).not.toBe('0deg');
    expect(activeVars.tiltY).not.toBe('0deg');

    await page.mouse.move(16, 16);

    await expect
      .poll(() => card.evaluate((el) => el.style.getPropertyValue('--tilt-x')))
      .toBe('0deg');
    await expect
      .poll(() => card.evaluate((el) => el.style.getPropertyValue('--tilt-y')))
      .toBe('0deg');
  });
});
