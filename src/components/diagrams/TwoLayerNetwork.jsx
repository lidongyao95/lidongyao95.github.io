export default function TwoLayerNetwork() {
  const W = 440;
  const H = 260;

  const accent = 'var(--accent, #00ff88)';
  const dim = 'rgba(255,255,255,0.25)';
  const dimText = 'rgba(255,255,255,0.5)';

  // Layer positions
  const l1x = 55;   // input
  const l2x = 200;  // hidden
  const l3x = 385;  // output

  // Node y positions
  const inY = [65, 135, 205];
  const hidY = [50, 120, 190];
  const outY = 130;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg" class="w-full max-w-md mx-auto">
      <defs>
        <marker id="arrowA" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={accent} />
        </marker>
      </defs>

      {/* Layer labels */}
      <text x={l1x} y={22} textAnchor="middle" fill={dimText} fontSize="12">输入层</text>
      <text x={l2x} y={22} textAnchor="middle" fill={dimText} fontSize="12">隐藏层</text>
      <text x={l3x} y={22} textAnchor="middle" fill={dimText} fontSize="12">输出层</text>

      <text x={l1x} y={H - 10} textAnchor="middle" fill={dimText} fontSize="10">x₁, x₂</text>
      <text x={l2x} y={H - 10} textAnchor="middle" fill={dimText} fontSize="10">h₁, h₂</text>
      <text x={l3x} y={H - 10} textAnchor="middle" fill={dimText} fontSize="10">ŷ</text>

      {/* Input nodes */}
      {inY.map((y, i) => (
        <g key={`in-${i}`}>
          <circle cx={l1x} cy={y} r="14" fill="none" stroke={dim} strokeWidth="1.5" />
          <text x={l1x} y={y + 5} textAnchor="middle" fill="white" fontSize="12" fontFamily="monospace">x{i+1}</text>
        </g>
      ))}

      {/* Hidden nodes */}
      {hidY.map((y, i) => (
        <g key={`hid-${i}`}>
          <circle cx={l2x} cy={y} r="16" fill="none" stroke={accent} strokeWidth="2" />
          <text x={l2x} y={y + 5} textAnchor="middle" fill="white" fontSize="12" fontFamily="monospace">h{i+1}</text>
          <text x={l2x} y={y + 20} textAnchor="middle" fill={dimText} fontSize="9">σ</text>
        </g>
      ))}

      {/* Output node */}
      <circle cx={l3x} cy={outY} r="16" fill="none" stroke={accent} strokeWidth="2" />
      <text x={l3x} y={outY + 5} textAnchor="middle" fill="white" fontSize="12" fontFamily="monospace">ŷ</text>
      <text x={l3x} y={outY + 20} textAnchor="middle" fill={dimText} fontSize="9">σ</text>

      {/* Connections: input → hidden (all to all) */}
      {inY.map((iy, ii) =>
        hidY.map((hy, hi) => (
          <line key={`i${ii}h${hi}`} x1={l1x + 14} y1={iy} x2={l2x - 16} y2={hy} stroke={accent} strokeOpacity="0.25" strokeWidth="0.8" />
        ))
      )}

      {/* Connections: hidden → output (all to all) */}
      {hidY.map((hy, hi) => (
        <line key={`h${hi}o`} x1={l2x + 16} y1={hy} x2={l3x - 16} y2={outY} stroke={accent} strokeOpacity="0.25" strokeWidth="0.8" />
      ))}

      {/* Layer boxes */}
      <rect x={l1x - 30} y={inY[0] - 24} width={60} height={inY[2] - inY[0] + 48} rx="8" fill="none" stroke={dim} strokeWidth="0.8" strokeDasharray="4,3" />
      <rect x={l2x - 32} y={hidY[0] - 26} width={64} height={hidY[2] - hidY[0] + 52} rx="8" fill="none" stroke={accent} strokeOpacity="0.2" strokeWidth="0.8" strokeDasharray="4,3" />

      {/* W₁ label */}
      <text x={(l1x + l2x) / 2} y={inY[0] - 30} textAnchor="middle" fill={dimText} fontSize="10" fontFamily="monospace">矩阵 W₁</text>
      {/* W₂ label */}
      <text x={(l2x + l3x) / 2} y={inY[0] - 30} textAnchor="middle" fill={dimText} fontSize="10" fontFamily="monospace">向量 W₂</text>
    </svg>
  );
}
