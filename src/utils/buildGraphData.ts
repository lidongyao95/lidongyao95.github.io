import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';

const BLOG_DIR = path.join(process.cwd(), 'src/content/blog');

export interface GraphArticle {
  id: string;
  title: string;
  excerpt: string;
  date: string;
  href: string;
  group: string;
}

export interface GraphNode {
  id: string;
  label: string;
  description: string;
  group: string;
  groupLabel: string;
  articleIds: string[];
  articles: GraphArticle[];
  degree: number;
  weight: number;
}

export interface GraphLink {
  source: string;
  target: string;
  weight: number;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
  articles: GraphArticle[];
  groups: Array<{ id: string; label: string }>;
}

interface TopicDefinition {
  id: string;
  label: string;
  description: string;
  group: string;
  articleIds: string[];
}

const GROUP_LABELS: Record<string, string> = {
  sequence: '序列建模',
  training: '训练与对齐',
  rag: 'RAG',
  agent: 'Agent 工程',
  graphics: '计算机图形学',
  misc: '其他',
};

const TOPICS: TopicDefinition[] = [
  {
    id: 'sequence-transformer',
    label: 'Transformer',
    description: 'Self-Attention 与现代 LLM 架构的起点。',
    group: 'sequence',
    articleIds: ['transformer-architecture'],
  },
  {
    id: 'sequence-rnn',
    label: 'RNN / LSTM',
    description: '循环网络、门控机制与梯度流动。',
    group: 'sequence',
    articleIds: ['rnn-lstm-gru'],
  },
  {
    id: 'sequence-linear-attention',
    label: 'Linear Attention',
    description: '从 RNN 视角理解线性注意力。',
    group: 'sequence',
    articleIds: ['rnn-to-linear-attention'],
  },
  {
    id: 'sequence-mamba',
    label: 'Mamba',
    description: '状态空间模型与高效序列建模。',
    group: 'sequence',
    articleIds: ['mamba-ssm'],
  },
  {
    id: 'training-pretrain',
    label: '预训练 / 微调',
    description: '模型训练范式与参数更新路径。',
    group: 'training',
    articleIds: ['pretraining-and-finetuning'],
  },
  {
    id: 'training-alignment',
    label: 'SFT / RLHF',
    description: '大模型从预训练到对齐的完整链路。',
    group: 'training',
    articleIds: ['pretrain-sft-rlhf'],
  },
  {
    id: 'training-interpretability',
    label: '泛化 / 解释性',
    description: '模型为什么做对，以及为什么做错。',
    group: 'training',
    articleIds: ['generalization-and-interpretability'],
  },
  {
    id: 'training-feature-vectors',
    label: '功能向量',
    description: '激活空间中的方向、特征与可编辑知识。',
    group: 'training',
    articleIds: ['feature-vectors-in-llm'],
  },
  {
    id: 'training-neural-basics',
    label: '神经网络分类',
    description: '从像素特征到类别预测的基础链路。',
    group: 'training',
    articleIds: ['nn-classification'],
  },
  {
    id: 'rag-system',
    label: 'RAG',
    description: '从开卷答题直觉到生产检索工程。',
    group: 'rag',
    articleIds: ['rag-basics', 'rag-engineering'],
  },
  {
    id: 'agent-harness',
    label: 'Agent Harness',
    description: '可靠 Agent 的编排框架、评测与生产实践。',
    group: 'agent',
    articleIds: ['agent-harness-part1', 'agent-harness-part2'],
  },
  {
    id: 'agent-skills',
    label: 'Skills',
    description: '把经验封装成可复用的程序性知识。',
    group: 'agent',
    articleIds: ['ai-agent-skills'],
  },
  {
    id: 'agent-mcp',
    label: 'MCP',
    description: 'LLM 工具集成的通用协议接口。',
    group: 'agent',
    articleIds: ['mcp-model-context-protocol'],
  },
  {
    id: 'agent-loop',
    label: 'Loop Engineering',
    description: '用循环组织 Agent 的持续工作过程。',
    group: 'agent',
    articleIds: ['loop-engineering'],
  },
  {
    id: 'agent-coding',
    label: 'Coding is Solved',
    description: '编码自动化之后，软件团队的新瓶颈。',
    group: 'agent',
    articleIds: ['coding-is-solved'],
  },
  {
    id: 'graphics-camera-model',
    label: '线性相机模型',
    description: '从世界坐标到像素坐标的投影几何。',
    group: 'graphics',
    articleIds: ['linear-camera-model-calibration'],
  },
  {
    id: 'graphics-simple-stereo',
    label: 'Simple Stereo',
    description: '用 baseline、disparity 和 scan-line matching 恢复深度。',
    group: 'graphics',
    articleIds: ['simple-stereo-vision'],
  },
  {
    id: 'misc-hello',
    label: 'Hello World',
    description: '博客起点与站点介绍。',
    group: 'misc',
    articleIds: ['hello-world'],
  },
];

const STRUCTURAL_LINKS: Array<{ source: string; target: string; weight?: number }> = [
  { source: 'sequence-transformer', target: 'sequence-linear-attention' },
  { source: 'sequence-rnn', target: 'sequence-linear-attention' },
  { source: 'sequence-linear-attention', target: 'sequence-mamba' },
  { source: 'training-pretrain', target: 'training-alignment' },
  { source: 'training-pretrain', target: 'training-neural-basics' },
  { source: 'training-alignment', target: 'training-interpretability' },
  { source: 'training-interpretability', target: 'training-feature-vectors' },
  { source: 'agent-harness', target: 'agent-loop' },
  { source: 'agent-harness', target: 'agent-skills' },
  { source: 'agent-harness', target: 'agent-mcp' },
  { source: 'agent-loop', target: 'agent-coding' },
  { source: 'graphics-camera-model', target: 'graphics-simple-stereo' },
];

function formatDate(date: unknown): string {
  if (date instanceof Date) return date.toISOString();
  if (typeof date === 'string') return date;
  return '';
}

function addLink(
  linksByKey: Map<string, GraphLink>,
  source: string,
  target: string,
  weight = 1,
) {
  const [a, b] = [source, target].sort();
  const key = `${a}--${b}`;
  const link = linksByKey.get(key);

  if (link) {
    link.weight += weight;
    return;
  }

  linksByKey.set(key, {
    source: a,
    target: b,
    weight,
  });
}

function buildFallbackTopic(article: GraphArticle): TopicDefinition {
  return {
    id: `article-${article.id}`,
    label: article.title.split(/[：:]/)[0].trim() || article.title,
    description: article.excerpt || article.title,
    group: article.group || 'misc',
    articleIds: [article.id],
  };
}

export function buildGraphData(): GraphData {
  if (!fs.existsSync(BLOG_DIR)) {
    return { nodes: [], links: [], articles: [], groups: [] };
  }

  const files = fs
    .readdirSync(BLOG_DIR)
    .filter((f) => f.endsWith('.md') || f.endsWith('.mdx'))
    .sort();

  const articles: GraphArticle[] = [];

  for (const file of files) {
    const slug = file.replace(/\.(md|mdx)$/, '');
    const raw = fs.readFileSync(path.join(BLOG_DIR, file), 'utf-8');
    const { data } = matter(raw);
    const group = typeof data.group === 'string' ? data.group : '';

    articles.push({
      id: slug,
      title: data.title || slug,
      excerpt: data.excerpt || '',
      date: formatDate(data.date),
      href: `/blog/${slug}`,
      group,
    });
  }

  articles.sort((a, b) => {
    const dateDiff = new Date(b.date).valueOf() - new Date(a.date).valueOf();
    return dateDiff || a.id.localeCompare(b.id);
  });

  const articlesById = new Map(articles.map((article) => [article.id, article]));
  const topics = TOPICS.filter((topic) =>
    topic.articleIds.some((articleId) => articlesById.has(articleId)),
  );
  const assignedArticleIds = new Set(topics.flatMap((topic) => topic.articleIds));

  for (const article of articles) {
    if (!assignedArticleIds.has(article.id)) {
      topics.push(buildFallbackTopic(article));
      assignedArticleIds.add(article.id);
    }
  }

  const linksByKey = new Map<string, GraphLink>();

  for (const link of STRUCTURAL_LINKS) {
    const hasSource = topics.some((topic) => topic.id === link.source);
    const hasTarget = topics.some((topic) => topic.id === link.target);
    if (hasSource && hasTarget) {
      addLink(linksByKey, link.source, link.target, link.weight || 1);
    }
  }

  const links = [...linksByKey.values()];
  const degreeByTopicId = new Map(topics.map((topic) => [topic.id, 0]));

  for (const link of links) {
    degreeByTopicId.set(link.source, (degreeByTopicId.get(link.source) || 0) + link.weight);
    degreeByTopicId.set(link.target, (degreeByTopicId.get(link.target) || 0) + link.weight);
  }

  const nodes: GraphNode[] = topics.map((topic) => {
    const topicArticles = topic.articleIds
      .map((articleId) => articlesById.get(articleId))
      .filter((article): article is GraphArticle => Boolean(article))
      .sort((a, b) => new Date(b.date).valueOf() - new Date(a.date).valueOf());
    const degree = degreeByTopicId.get(topic.id) || 0;

    return {
      id: topic.id,
      label: topic.label,
      description: topic.description,
      group: topic.group,
      groupLabel: GROUP_LABELS[topic.group] || topic.group,
      articleIds: topicArticles.map((article) => article.id),
      articles: topicArticles,
      degree,
      weight: topicArticles.length + degree,
    };
  });

  const usedGroups = [...new Set(nodes.map((node) => node.group))];
  const groups = usedGroups.map((id) => ({
    id,
    label: GROUP_LABELS[id] || id,
  }));

  return { nodes, links, articles, groups };
}
