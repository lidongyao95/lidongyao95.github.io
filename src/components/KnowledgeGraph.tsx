import { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import type { GraphData, GraphNode } from '../utils/buildGraphData';

interface FGNode extends GraphNode {
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

interface Props {
  data: GraphData;
}

const COMMUNITY_PALETTE = [
  '#e2a045', // gold
  '#6366f1', // indigo
  '#22d3ee', // cyan
  '#f472b6', // pink
  '#34d399', // emerald
  '#fb923c', // orange
  '#a78bfa', // violet
  '#f87171', // red
  '#facc15', // yellow
  '#2dd4bf', // teal
];

const MISC_COLOR = '#475569';

export default function KnowledgeGraph({ data }: Props) {
  const fgRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredNode, setHoveredNode] = useState<FGNode | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  const communityColors = useMemo(() => {
    const groups = [...new Set(data.nodes.map((n) => n.group))].sort();
    const map: Record<string, string> = {};
    groups.forEach((g, i) => {
      if (g === 'misc') {
        map[g] = MISC_COLOR;
      } else {
        map[g] = COMMUNITY_PALETTE[i % COMMUNITY_PALETTE.length];
      }
    });
    return map;
  }, [data]);

  const legendItems = useMemo(() => {
    const counts = new Map<string, number>();
    for (const node of data.nodes) {
      counts.set(node.group, (counts.get(node.group) || 0) + 1);
    }

    // For each community, find the most-connected member as label
    const topTitles = new Map<string, string>();
    for (const node of data.nodes) {
      const current = topTitles.get(node.group);
      if (!current) {
        topTitles.set(node.group, node.title);
      } else {
        const currentNode = data.nodes.find((n) => n.title === current);
        if (!currentNode || node.degree > currentNode.degree) {
          topTitles.set(node.group, node.title);
        }
      }
    }

    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([group, count]) => ({
        group,
        color: communityColors[group] || MISC_COLOR,
        label:
          group === 'misc'
            ? '其他'
            : (() => {
                const t = topTitles.get(group) || group;
                return t.length > 14 ? t.slice(0, 14) + '…' : t;
              })(),
        count,
      }));
  }, [data, communityColors]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setDimensions({
          width: Math.max(entry.contentRect.width, 320),
          height: Math.max(entry.contentRect.height, 400),
        });
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const enrichedData = useMemo(() => {
    const n = data.nodes.length;
    const radius = Math.min(300, n * 20);
    const nodes = data.nodes.map((node, i) => {
      const angle = (2 * Math.PI * i) / n;
      return {
        ...node,
        x: radius * Math.cos(angle),
        y: radius * Math.sin(angle),
      };
    });
    return { ...data, nodes };
  }, [data]);

  const zoomedRef = useRef(false);
  const handleEngineStop = useCallback(() => {
    const fg = fgRef.current;
    if (fg && !zoomedRef.current) {
      zoomedRef.current = true;
      fg.zoomToFit(400, 60);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      const fg = fgRef.current;
      if (fg) {
        zoomedRef.current = true;
        fg.zoomToFit(400, 60);
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, [enrichedData]);

  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;

    const chargeForce = fg.d3Force('charge');
    if (chargeForce) chargeForce.strength(-250);

    const linkForce = fg.d3Force('link');
    if (linkForce) {
      linkForce.distance(110);
      linkForce.strength(0.75);
    }

    fg.d3Force('center')?.strength(0.05);

    const nodeMap = new Map<string, FGNode>();
    enrichedData.nodes.forEach((n) => nodeMap.set(n.id, n as FGNode));

    const clusterForce = (alpha: number) => {
      const centers = new Map<string, { x: number; y: number; count: number }>();
      for (const node of enrichedData.nodes) {
        if (node.group === 'misc') continue;

        const n = nodeMap.get(node.id) as FGNode;
        if (n.x == null || n.y == null) continue;
        const c = centers.get(node.group) || { x: 0, y: 0, count: 0 };
        c.x += n.x;
        c.y += n.y;
        c.count++;
        centers.set(node.group, c);
      }
      for (const [, c] of centers) {
        if (c.count > 0) {
          c.x /= c.count;
          c.y /= c.count;
        }
      }

      for (const node of enrichedData.nodes) {
        if (node.group === 'misc') continue;

        const n = nodeMap.get(node.id) as FGNode;
        if (n.x == null || n.y == null) continue;
        const center = centers.get(node.group);
        if (!center) continue;
        const strength = node.degree > 0 ? 0.04 : 0.01;
        n.vx! += (center.x - n.x!) * alpha * strength;
        n.vy! += (center.y - n.y!) * alpha * strength;
      }
    };

    fg.d3Force('cluster', clusterForce);
    fg.d3ReheatSimulation();
  }, [enrichedData]);

  const nodeCanvasObject = useCallback(
    (node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const fgNode = node as FGNode;
      const size = 4 + (fgNode.degree || 0) * 0.8;
      const x = fgNode.x ?? 0;
      const y = fgNode.y ?? 0;
      const color = communityColors[fgNode.group] || MISC_COLOR;
      const isHovered = hoveredNode?.id === fgNode.id;

      // Glow
      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur = isHovered ? 25 : 8;

      // Outer halo
      ctx.beginPath();
      ctx.arc(x, y, size + 2, 0, 2 * Math.PI);
      ctx.fillStyle = isHovered ? color + 'aa' : color + '25';
      ctx.fill();
      ctx.restore();

      // Core circle
      ctx.beginPath();
      ctx.arc(x, y, size, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();

      const showLabel = dimensions.width >= 640 || isHovered;
      if (!showLabel) return;

      const fontSize = Math.max(11 / globalScale, 2.5);
      ctx.font = `${fontSize}px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = isHovered ? '#ffffff' : 'rgba(255,255,255,0.55)';

      const label = fgNode.title;
      const maxChars = isHovered ? 30 : 10;
      const displayText =
        label.length > maxChars ? label.slice(0, maxChars) + '…' : label;
      ctx.fillText(displayText, x, y + size + 4);
    },
    [communityColors, dimensions.width, hoveredNode],
  );

  const handleNodeClick = useCallback((node: any) => {
    window.location.href = `/blog/${(node as FGNode).id}`;
  }, []);

  const handleNodeHover = useCallback((node: any) => {
    setHoveredNode(node as FGNode | null);
  }, []);

  if (data.nodes.length === 0) {
    return <p className="text-gray-500 text-center py-20">暂无文章</p>;
  }

  return (
    <div className="space-y-4">
      <div
        ref={containerRef}
        className="relative w-full rounded-xl overflow-hidden border border-white/5"
        style={{ height: '70vh', minHeight: 500, background: '#08091a' }}
      >
        <ForceGraph2D
          ref={fgRef}
          graphData={enrichedData}
          width={dimensions.width}
          height={dimensions.height}
          backgroundColor="#08091a"
          onEngineStop={handleEngineStop}
          // Node rendering
          nodeCanvasObject={nodeCanvasObject}
          nodeCanvasObjectMode={() => 'replace'}
          nodePointerAreaPaint={(node: any, color: string, ctx: CanvasRenderingContext2D) => {
            const fgNode = node as FGNode;
            const size = 4 + (fgNode.degree || 0) * 0.8 + 12;
            ctx.beginPath();
            ctx.arc(fgNode.x ?? 0, fgNode.y ?? 0, size, 0, 2 * Math.PI);
            ctx.fillStyle = color;
            ctx.fill();
          }}
          nodeVal={(node: any) => 4 + ((node as FGNode).degree || 0) * 0.8}
          nodeLabel="title"
          linkColor={() => 'rgba(255,255,255,0.10)'}
          linkWidth={1.2}
          linkDirectionalArrowLength={3}
          linkDirectionalArrowColor={() => 'rgba(255,255,255,0.12)'}
          linkCurvature={0.1}
          // Interactions
          onNodeClick={handleNodeClick}
          onNodeHover={handleNodeHover}
          // Physics
          warmupTicks={100}
          cooldownTicks={150}
          d3AlphaDecay={0.025}
          d3VelocityDecay={0.25}
        />

        {/* Hover tooltip */}
        {hoveredNode && (
          <div className="absolute top-4 left-4 bg-bg-dark/95 backdrop-blur-md border border-white/10 rounded-lg px-4 py-3 pointer-events-none max-w-xs z-10">
            <p className="text-white text-sm font-medium leading-snug">
              {hoveredNode.title}
            </p>
            <p className="text-gray-500 text-xs mt-1.5">
              {hoveredNode.degree} 个关联 ·{' '}
              {hoveredNode.date
                ? new Date(hoveredNode.date).toLocaleDateString('zh-CN')
                : ''}
            </p>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 justify-center">
        {legendItems.map((item) => (
          <div key={item.group} className="flex items-center gap-1.5 text-xs text-gray-500">
            <span
              className="w-2.5 h-2.5 rounded-full inline-block shrink-0"
              style={{ backgroundColor: item.color }}
            />
            <span>{item.label}</span>
            <span className="text-gray-700">({item.count})</span>
          </div>
        ))}
      </div>
    </div>
  );
}
