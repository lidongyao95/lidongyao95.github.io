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

const GROUP_COLORS: Record<string, string> = {
  sequence: '#22d3ee',
  training: '#e2a045',
  rag: '#34d399',
  agent: '#a78bfa',
  graphics: '#f472b6',
  misc: '#64748b',
};

const GROUP_CENTERS: Record<string, { x: number; y: number }> = {
  sequence: { x: -210, y: -80 },
  training: { x: 30, y: -105 },
  rag: { x: 210, y: 25 },
  agent: { x: -90, y: 130 },
  graphics: { x: 205, y: -150 },
  misc: { x: 230, y: 150 },
};

function nodeRadius(node: FGNode) {
  const articleBoost = Math.max(0, node.articles.length - 1) * 2.2;
  const degreeBoost = Math.min(5, node.degree * 1.4);
  return Math.min(20, 10.5 + articleBoost + degreeBoost);
}

function shouldShowLabel(node: FGNode, globalScale: number, isHovered: boolean, isSelected: boolean) {
  return (
    isHovered ||
    isSelected ||
    node.articles.length > 1 ||
    node.degree > 0 ||
    node.group === 'graphics' ||
    globalScale > 1.35
  );
}

function emitNodeSelection(node: FGNode | null) {
  window.dispatchEvent(
    new CustomEvent('knowledge-graph-select', {
      detail: node
        ? {
            id: node.id,
            label: node.label,
            description: node.description,
            groupLabel: node.groupLabel,
            articleIds: node.articleIds,
          }
        : null,
    }),
  );
}

export default function KnowledgeGraph({ data }: Props) {
  const fgRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredNode, setHoveredNode] = useState<FGNode | null>(null);
  const [selectedNode, setSelectedNode] = useState<FGNode | null>(null);
  const [dimensions, setDimensions] = useState({ width: 760, height: 620 });

  const graphData = useMemo(() => {
    const nodes = data.nodes.map((node) => {
      const center = GROUP_CENTERS[node.group] || GROUP_CENTERS.misc;
      const offset = node.id
        .split('')
        .reduce((sum, char, index) => sum + char.charCodeAt(0) * (index + 1), 0);
      const angle = (offset % 360) * (Math.PI / 180);
      const radius = 18 + (offset % 42);

      return {
        ...node,
        x: center.x + Math.cos(angle) * radius,
        y: center.y + Math.sin(angle) * radius,
      };
    });

    return { ...data, nodes };
  }, [data]);

  const linkedNodeIds = useMemo(() => {
    if (!hoveredNode && !selectedNode) return new Set<string>();
    const activeId = hoveredNode?.id || selectedNode?.id;
    const ids = new Set<string>(activeId ? [activeId] : []);

    for (const link of data.links) {
      if (link.source === activeId) ids.add(String(link.target));
      if (link.target === activeId) ids.add(String(link.source));
    }

    return ids;
  }, [data.links, hoveredNode, selectedNode]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;

      setDimensions({
        width: Math.max(entry.contentRect.width, 320),
        height: Math.max(entry.contentRect.height, 420),
      });
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;

    fg.d3Force('charge')?.strength(-105);
    fg.d3Force('center')?.strength(0.04);

    const linkForce = fg.d3Force('link');
    if (linkForce) {
      linkForce.distance(82);
      linkForce.strength(0.55);
    }

    const groupForce = (alpha: number) => {
      for (const node of graphData.nodes as FGNode[]) {
        if (node.x == null || node.y == null) continue;
        const center = GROUP_CENTERS[node.group] || GROUP_CENTERS.misc;
        const strength = node.group === 'graphics' ? 0.055 : 0.035;
        node.vx! += (center.x - node.x) * alpha * strength;
        node.vy! += (center.y - node.y) * alpha * strength;
      }
    };

    fg.d3Force('group', groupForce);
    fg.d3ReheatSimulation();
  }, [graphData]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      fgRef.current?.zoomToFit(450, 64);
    }, 900);

    return () => window.clearTimeout(timer);
  }, [graphData]);

  useEffect(() => {
    const handleExternalSelection = (event: Event) => {
      if ((event as CustomEvent).detail === null) {
        setSelectedNode(null);
      }
    };

    window.addEventListener('knowledge-graph-select', handleExternalSelection);
    return () => window.removeEventListener('knowledge-graph-select', handleExternalSelection);
  }, []);

  const nodeCanvasObject = useCallback(
    (node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const fgNode = node as FGNode;
      const x = fgNode.x ?? 0;
      const y = fgNode.y ?? 0;
      const radius = nodeRadius(fgNode);
      const color = GROUP_COLORS[fgNode.group] || GROUP_COLORS.misc;
      const isHovered = hoveredNode?.id === fgNode.id;
      const isSelected = selectedNode?.id === fgNode.id;
      const isDimmed = linkedNodeIds.size > 0 && !linkedNodeIds.has(fgNode.id);

      ctx.save();
      ctx.globalAlpha = isDimmed ? 0.34 : 1;
      ctx.shadowColor = color;
      ctx.shadowBlur = isHovered || isSelected ? 24 : 7;

      ctx.beginPath();
      ctx.arc(x, y, radius + (isHovered || isSelected ? 7 : 3), 0, 2 * Math.PI);
      ctx.fillStyle = isHovered || isSelected ? `${color}66` : `${color}24`;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(x, y, radius, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(x, y, Math.max(3, radius * 0.42), 0, 2 * Math.PI);
      ctx.fillStyle = 'rgba(8,9,26,0.55)';
      ctx.fill();

      ctx.restore();

      if (!shouldShowLabel(fgNode, globalScale, isHovered, isSelected)) return;

      const screenFontSize = isHovered || isSelected ? 15 : 13;
      const fontSize = Math.max(screenFontSize / globalScale, 4.8);
      const placeLabelLeft = x > 140;
      const labelX = placeLabelLeft ? x - radius - 7 / globalScale : x + radius + 7 / globalScale;
      const labelY = y - fontSize * 0.58;

      ctx.save();
      ctx.globalAlpha = isDimmed ? 0.42 : 1;
      ctx.font = `600 ${fontSize}px system-ui, -apple-system, "PingFang SC", "Noto Sans SC", "Microsoft YaHei", sans-serif`;
      ctx.textAlign = placeLabelLeft ? 'right' : 'left';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(8,9,26,0.82)';
      ctx.lineWidth = 4 / globalScale;
      ctx.strokeText(fgNode.label, labelX, labelY);
      ctx.fillStyle = isHovered || isSelected ? '#ffffff' : 'rgba(255,255,255,0.78)';
      ctx.fillText(fgNode.label, labelX, labelY);
      ctx.restore();
    },
    [hoveredNode, linkedNodeIds, selectedNode],
  );

  const handleNodeClick = useCallback((node: any) => {
    const fgNode = node as FGNode;
    setSelectedNode(fgNode);
    emitNodeSelection(fgNode);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedNode(null);
    emitNodeSelection(null);
  }, []);

  if (data.nodes.length === 0) {
    return <p className="py-20 text-center text-gray-500">暂无文章</p>;
  }

  return (
    <div className="space-y-3" data-testid="knowledge-graph">
      <div
        ref={containerRef}
        className="relative w-full overflow-hidden rounded-lg border border-white/10"
        style={{ height: 'min(68vh, 680px)', minHeight: 460, background: '#08091a' }}
      >
        <ForceGraph2D
          ref={fgRef}
          graphData={graphData}
          width={dimensions.width}
          height={dimensions.height}
          backgroundColor="#08091a"
          onEngineStop={() => fgRef.current?.zoomToFit(450, 64)}
          nodeCanvasObject={nodeCanvasObject}
          nodeCanvasObjectMode={() => 'replace'}
          nodePointerAreaPaint={(node: any, color: string, ctx: CanvasRenderingContext2D) => {
            const fgNode = node as FGNode;
            ctx.beginPath();
            ctx.arc(fgNode.x ?? 0, fgNode.y ?? 0, nodeRadius(fgNode) + 14, 0, 2 * Math.PI);
            ctx.fillStyle = color;
            ctx.fill();
          }}
          nodeVal={(node: any) => Math.pow(nodeRadius(node as FGNode), 2)}
          nodeLabel={(node: any) => `${(node as FGNode).label} · ${(node as FGNode).groupLabel}`}
          linkColor={(link: any) => {
            const source = typeof link.source === 'object' ? link.source.id : link.source;
            const target = typeof link.target === 'object' ? link.target.id : link.target;
            const activeId = hoveredNode?.id || selectedNode?.id;
            if (activeId && source !== activeId && target !== activeId) return 'rgba(255,255,255,0.05)';
            return 'rgba(255,255,255,0.18)';
          }}
          linkWidth={(link: any) => Math.min(2.6, 1.2 + (link.weight || 1) * 0.35)}
          linkCurvature={0.08}
          onNodeClick={handleNodeClick}
          onNodeHover={(node: any) => setHoveredNode(node as FGNode | null)}
          warmupTicks={70}
          cooldownTicks={110}
          d3AlphaDecay={0.035}
          d3VelocityDecay={0.35}
        />

        {selectedNode && (
          <button
            type="button"
            onClick={clearSelection}
            className="absolute right-3 top-3 rounded-md border border-white/10 bg-bg-dark/90 px-3 py-1.5 text-xs text-gray-300 backdrop-blur transition-colors hover:border-accent/40 hover:text-accent"
          >
            返回全部
          </button>
        )}

      </div>

    </div>
  );
}
