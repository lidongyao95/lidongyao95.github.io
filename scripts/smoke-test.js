/**
 * Smoke tests — parse built HTML files and check content integrity.
 * Fast, no browser needed. Run after `npm run build`.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as cheerio from 'cheerio';

const DOCS_DIR = path.resolve('docs');
let errors = 0;
let passed = 0;

function assert(condition, msg) {
  if (condition) {
    passed++;
  } else {
    console.error(`  ✗ ${msg}`);
    errors++;
  }
}

function walkHtml(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { recursive: true })) {
    if (entry.endsWith('.html')) files.push(path.join(dir, entry));
  }
  return files;
}

const files = walkHtml(DOCS_DIR);

// ── File existence & basic validity ──
console.log('\n📄 Page existence & validity');
for (const file of files) {
  const rel = path.relative(DOCS_DIR, file);
  const html = fs.readFileSync(file, 'utf-8');
  const $ = cheerio.load(html);

  assert(html.length > 100, `${rel}: file non-empty (>100 chars)`);
  assert($('html').length === 1, `${rel}: has <html> tag`);
  assert($('head').length === 1, `${rel}: has <head> tag`);
  assert($('body').length === 1, `${rel}: has <body> tag`);
  assert($('title').text().length > 0, `${rel}: has non-empty <title>`);
}

// ── Home page ──
console.log('\n🏠 Home page');
{
  const $ = cheerio.load(fs.readFileSync(path.join(DOCS_DIR, 'index.html'), 'utf-8'));

  // Language
  assert($('html').attr('lang') === 'zh-CN', 'lang="zh-CN"');

  // Meta description
  const desc = $('meta[name="description"]').attr('content');
  assert(desc && desc.length > 0, 'meta description exists');

  // Hero section
  assert($('#home').length === 1, 'section #home exists');
  assert($('h1').text().includes('你好'), 'hero heading has Chinese greeting');
  assert($('#typed-target').length === 1, 'typed.js target element exists');

  // Hero buttons
  const heroLinks = $('#home a');
  const heroHrefs = [];
  heroLinks.each((_, el) => heroHrefs.push($(el).attr('href')));
  assert(heroHrefs.includes('/#projects'), 'hero: 查看项目 button → /#projects');
  assert(heroHrefs.includes('/blog'), 'hero: 阅读博客 button → /blog');
  assert(heroHrefs.includes('/#contact'), 'hero: 联系我 button → /#contact');

  // Sections
  assert($('#about').length === 1, 'section #about exists');
  assert($('#skills').length === 1, 'section #skills exists');
  assert($('#projects').length === 1, 'section #projects exists');
  assert($('#blog').length === 1, 'section #blog exists');
  assert($('#contact').length === 1, 'section #contact exists');

  // Section headings
  assert($('#about h2').text().includes('关于我'), '关于我 heading');
  assert($('#skills h2').text().includes('技术栈'), '技术栈 heading');
  assert($('#projects h2').text().includes('精选项目'), '精选项目 heading');
  assert($('#blog h2').text().includes('最新文章'), '最新文章 heading');
  assert($('#contact h2').text().includes('联系我'), '联系我 heading');

  // Blog preview shows latest post
  const blogLinks = $('#blog a[href^="/blog"]');
  assert(blogLinks.length >= 3, 'blog preview has latest post links');
  assert($('#blog').text().includes('模型的泛化能力'), 'blog preview shows generalization post');
  assert($('#blog').text().includes('模型训练范式'), 'blog preview shows pretraining post');

  // Project cards link to GitHub
  const projectLinks = $('#projects a[href*="github.com"]');
  assert(projectLinks.length === 3, '3 project cards with GitHub links');
  projectLinks.each((_, el) => {
    const href = $(el).attr('href');
    const target = $(el).attr('target');
    const rel = $(el).attr('rel');
    assert(href.startsWith('https://github.com/lidongyao95/'), `project link: ${href.split('/').pop()}`);
    assert(target === '_blank', `project ${href.split('/').pop()} target="_blank"`);
    assert(rel === 'noopener noreferrer', `project ${href.split('/').pop()} rel="noopener noreferrer"`);
  });

  // Contact links
  const contactLinks = $('#contact a');
  const contactHrefs = [];
  contactLinks.each((_, el) => contactHrefs.push($(el).attr('href')));
  assert(contactHrefs.some(h => h && h.includes('github.com/lidongyao95')), 'GitHub link in contact');
  assert(contactHrefs.some(h => h && h.startsWith('mailto:')), 'Email link in contact');
}

// ── Nav (shared across all pages) ──
console.log('\n🧭 Navigation');
for (const file of files) {
  const rel = path.relative(DOCS_DIR, file);
  const $ = cheerio.load(fs.readFileSync(file, 'utf-8'));

  const navLinks = $('nav a');
  const navHrefs = [];
  navLinks.each((_, el) => navHrefs.push($(el).attr('href')));

  assert(navHrefs.includes('/'), `${rel}: nav has 首页 (/)`);
  assert(navHrefs.includes('/#about'), `${rel}: nav has 关于 (/#about)`);
  assert(navHrefs.includes('/#projects'), `${rel}: nav has 项目 (/#projects)`);
  assert(navHrefs.includes('/blog'), `${rel}: nav has 博客 (/blog)`);
  assert(navHrefs.includes('/#contact'), `${rel}: nav has 联系 (/#contact)`);
  assert($('nav').html().includes('&lt;DL /&gt;') || $('nav').text().includes('<DL'), `${rel}: nav has logo`);
}

// ── Blog listing page ──
console.log('\n📋 Blog listing');
{
  const $ = cheerio.load(fs.readFileSync(path.join(DOCS_DIR, 'blog/index.html'), 'utf-8'));

  assert($('h1').text().includes('博客'), 'blog listing title = 博客');
  const postLinks = $('a[href^="/blog/"]');
  assert(postLinks.length >= 5, `blog listing has >= 5 posts (found ${postLinks.length})`);
  assert($('body').text().includes('模型的泛化能力'), 'blog listing shows generalization post');
  assert($('body').text().includes('模型训练范式'), 'blog listing shows pretraining post');
  assert($('body').text().includes('Transformer 架构详解'), 'blog listing shows transformer post');
  assert($('body').text().includes('神经网络分类'), 'blog listing shows nn-classification');
  assert($('body').text().includes('你好，世界'), 'blog listing shows hello-world');
}

// ── Blog post: nn-classification ──
console.log('\n📝 Blog post: nn-classification');
{
  const $ = cheerio.load(fs.readFileSync(path.join(DOCS_DIR, 'blog/nn-classification/index.html'), 'utf-8'));

  // Back link
  const backLink = $('a[href="/blog"]');
  assert(backLink.length >= 1, 'has back-to-blog link');

  // Chinese content
  assert($('body').text().includes('神经网络分类任务的底层原理'), 'title in page');
  assert($('body').text().includes('前向传播'), 'contains 前向传播');
  assert($('body').text().includes('梯度下降'), 'contains 梯度下降');

  // KaTeX math
  const katexElements = $('.katex');
  assert(katexElements.length > 10, `KaTeX formulas present (>10, found ${katexElements.length})`);

  // SVG diagrams (4 diagram components)
  const svgElements = $('svg');
  assert(svgElements.length >= 4, `SVG diagrams present (>=4, found ${svgElements.length})`);

  // Tables
  const tableElements = $('table');
  assert(tableElements.length >= 3, `tables present (>=3, found ${tableElements.length})`);
  $('table').each((i, table) => {
    assert($(table).find('thead').length === 1, `table ${i + 1}: has thead`);
    assert($(table).find('tbody').length === 1, `table ${i + 1}: has tbody`);
  });

  // Prose class for typography
  assert($('.prose').length >= 1, 'prose class applied');
}

// ── External link audit ──
console.log('\n🔗 External links');
for (const file of files) {
  const rel = path.relative(DOCS_DIR, file);
  const $ = cheerio.load(fs.readFileSync(file, 'utf-8'));
  $('a[href^="http"]').each((_, el) => {
    const href = $(el).attr('href');
    const target = $(el).attr('target');
    const relAttr = $(el).attr('rel');
    assert(target === '_blank', `${rel}: external ${href} → target="_blank"`);
    assert(relAttr && relAttr.includes('noopener'), `${rel}: external ${href} → rel has noopener`);
  });
}

// ── Summary ──
console.log(`\n${'─'.repeat(50)}`);
console.log(`  ✅  Passed: ${passed}`);
if (errors > 0) {
  console.log(`  ❌  Errors: ${errors}`);
  process.exit(1);
} else {
  console.log(`  🎉  All smoke tests passed!`);
}
