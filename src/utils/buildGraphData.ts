import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';

const BLOG_DIR = path.join(process.cwd(), 'src/content/blog');
const COMMUNITY_THRESHOLD = 0.3;

export interface GraphNode {
  id: string;
  title: string;
  date: string;
  group: string;
  degree: number;
}

export interface GraphLink {
  source: string;
  target: string;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

function extractExplicitLinks(body: string, slugs: Set<string>, selfSlug: string): string[] {
  const links: string[] = [];

  const regex = /\[[^\]]+\]\(\/blog\/([a-z0-9-]+)(?:\/)?(?:#[^)]+)?\)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(body)) !== null) {
    const target = match[1];
    if (target !== selfSlug && slugs.has(target) && !links.includes(target)) {
      links.push(target);
    }
  }
  return links;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;

  let intersection = 0;
  for (const item of a) {
    if (b.has(item)) intersection++;
  }

  const union = new Set([...a, ...b]);
  return union.size === 0 ? 0 : intersection / union.size;
}

function buildNeighborMap(nodes: GraphNode[], links: GraphLink[]): Map<string, Set<string>> {
  const neighbors = new Map<string, Set<string>>();
  for (const node of nodes) neighbors.set(node.id, new Set());

  for (const link of links) {
    neighbors.get(link.source)?.add(link.target);
    neighbors.get(link.target)?.add(link.source);
  }

  return neighbors;
}

class UnionFind {
  private parent = new Map<string, string>();

  constructor(ids: string[]) {
    for (const id of ids) this.parent.set(id, id);
  }

  find(id: string): string {
    const parent = this.parent.get(id);
    if (!parent || parent === id) return id;

    const root = this.find(parent);
    this.parent.set(id, root);
    return root;
  }

  union(a: string, b: string) {
    const rootA = this.find(a);
    const rootB = this.find(b);
    if (rootA !== rootB) {
      this.parent.set(rootB, rootA);
    }
  }
}

function detectCommunities(
  nodes: GraphNode[],
  links: GraphLink[],
  threshold = COMMUNITY_THRESHOLD,
): Map<string, string> {
  const ids = nodes.map((node) => node.id);
  const neighbors = buildNeighborMap(nodes, links);
  const unionFind = new UnionFind(ids);

  const closedNeighbors = new Map<string, Set<string>>();
  for (const id of ids) {
    closedNeighbors.set(id, new Set([id, ...(neighbors.get(id) ?? [])]));
  }

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i].id;
      const b = nodes[j].id;
      const aNeighbors = neighbors.get(a);
      const bNeighbors = neighbors.get(b);

      if (!aNeighbors?.size && !bNeighbors?.size) continue;

      const score = jaccard(closedNeighbors.get(a)!, closedNeighbors.get(b)!);
      if (score >= threshold) {
        unionFind.union(a, b);
      }
    }
  }

  const groups = new Map<string, string[]>();
  for (const id of ids) {
    if ((neighbors.get(id)?.size ?? 0) === 0) continue;

    const root = unionFind.find(id);
    const group = groups.get(root) ?? [];
    group.push(id);
    groups.set(root, group);
  }

  const degreeById = new Map(nodes.map((node) => [node.id, node.degree]));
  const sortedGroups = [...groups.values()].sort((a, b) => {
    if (b.length !== a.length) return b.length - a.length;

    const degreeA = a.reduce((sum, id) => sum + (degreeById.get(id) ?? 0), 0);
    const degreeB = b.reduce((sum, id) => sum + (degreeById.get(id) ?? 0), 0);
    if (degreeB !== degreeA) return degreeB - degreeA;

    return a[0].localeCompare(b[0]);
  });

  const community = new Map<string, string>();
  for (const id of ids) community.set(id, 'misc');

  sortedGroups.forEach((group, index) => {
    for (const id of group) {
      community.set(id, `cluster-${index}`);
    }
  });

  return community;
}

function formatDate(date: unknown): string {
  if (date instanceof Date) return date.toISOString();
  if (typeof date === 'string') return date;
  return '';
}

function addDirectedLink(links: GraphLink[], linkSet: Set<string>, source: string, target: string) {
  const key = `${source}->${target}`;
  if (!linkSet.has(key)) {
    linkSet.add(key);
    links.push({ source, target });
  }
}

export function buildGraphData(): GraphData {
  if (!fs.existsSync(BLOG_DIR)) {
    return { nodes: [], links: [] };
  }

  const files = fs
    .readdirSync(BLOG_DIR)
    .filter((f) => f.endsWith('.md') || f.endsWith('.mdx'))
    .sort();

  const slugs = new Set(files.map((f) => f.replace(/\.(md|mdx)$/, '')));

  interface RawNode {
    id: string;
    title: string;
    date: string;
    explicitLinks: string[];
    group?: string;
  }

  const rawNodes: RawNode[] = [];

  for (const file of files) {
    const slug = file.replace(/\.(md|mdx)$/, '');
    const raw = fs.readFileSync(path.join(BLOG_DIR, file), 'utf-8');
    const { data, content } = matter(raw);

    const explicitLinks = extractExplicitLinks(content, slugs, slug);

    rawNodes.push({
      id: slug,
      title: data.title || slug,
      date: formatDate(data.date),
      explicitLinks,
      group: typeof data.group === 'string' ? data.group : undefined,
    });
  }

  const linkSet = new Set<string>();
  const links: GraphLink[] = [];

  for (const node of rawNodes) {
    for (const target of node.explicitLinks) {
      addDirectedLink(links, linkSet, node.id, target);
    }
  }

  const degreeMap = new Map<string, number>();
  for (const slug of slugs) degreeMap.set(slug, 0);

  for (const link of links) {
    degreeMap.set(link.source, degreeMap.get(link.source)! + 1);
    degreeMap.set(link.target, degreeMap.get(link.target)! + 1);
  }

  const nodes: GraphNode[] = rawNodes.map((n) => ({
    id: n.id,
    title: n.title,
    date: n.date,
    group: n.group || '',
    degree: degreeMap.get(n.id) || 0,
  }));

  const communities = detectCommunities(nodes, links);
  for (const node of nodes) {
    if (!node.group) {
      node.group = communities.get(node.id) || 'misc';
    }
  }

  return { nodes, links };
}
