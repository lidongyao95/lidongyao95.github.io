import * as fs from 'node:fs';
import * as path from 'node:path';

const BLOG_DIR = path.resolve('src/content/blog');

function listContentFiles(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listContentFiles(fullPath));
    } else if (/\.(md|mdx)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

function stripQuotes(value) {
  const trimmed = value.trim();
  const quote = trimmed[0];
  if ((quote === '"' || quote === "'") && trimmed.at(-1) === quote) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseFrontmatter(source) {
  const match = source.match(/^---\n([\s\S]*?)\n---/);
  const frontmatter = {};
  if (!match) return frontmatter;

  for (const line of match[1].split('\n')) {
    const field = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (field) {
      frontmatter[field[1]] = stripQuotes(field[2]);
    }
  }
  return frontmatter;
}

function parseHeadings(source) {
  const body = source.replace(/^---\n[\s\S]*?\n---\n?/, '');
  const headings = [];
  let inFence = false;

  for (const line of body.split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    const match = line.match(/^(#{2,3})\s+(.+?)\s*#*\s*$/);
    if (match) {
      headings.push({
        depth: match[1].length,
        text: match[2].replace(/[`*_]/g, '').trim(),
      });
    }
  }

  return headings;
}

function slugFromFile(file) {
  return path
    .relative(BLOG_DIR, file)
    .replace(/\.(md|mdx)$/, '')
    .split(path.sep)
    .join('/');
}

export function getBlogPosts() {
  return listContentFiles(BLOG_DIR)
    .map((file) => {
      const source = fs.readFileSync(file, 'utf-8');
      const data = parseFrontmatter(source);
      const slug = slugFromFile(file);

      return {
        file,
        slug,
        href: `/blog/${slug}`,
        title: data.title ?? slug,
        date: new Date(data.date),
        excerpt: data.excerpt,
        headings: parseHeadings(source),
      };
    })
    .sort((a, b) => b.date.valueOf() - a.date.valueOf() || a.slug.localeCompare(b.slug));
}

export function getLatestBlogPosts(limit = 3) {
  return getBlogPosts().slice(0, limit);
}
