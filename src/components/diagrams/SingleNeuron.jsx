export default function SingleNeuron() {
  const W = 400;
  const H = 200;

  // Node positions
  const x1 = 50, x2 = 50, xz = 240, xy = 350;
  const y1 = 55, y2 = 145, yMid = 100;

  const strokeColor = 'var(--accent, #00ff88)';
  const dimColor = 'rgba(255,255,255,0.3)';

  return (
    <svg viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg" class="w-full max-w-sm mx-auto">
      {/* x1 node */}
      <circle cx={x1} cy={y1} r="18" fill="none" stroke={dimColor} strokeWidth="1.5" />
      <text x={x1} y={y1 + 5} textAnchor="middle" fill="white" fontSize="14" fontFamily="monospace">x₁</text>

      {/* x2 node */}
      <circle cx={x2} cy={y2} r="18" fill="none" stroke={dimColor} strokeWidth="1.5" />
      <text x={x2} y={y2 + 5} textAnchor="middle" fill="white" fontSize="14" fontFamily="monospace">x₂</text>

      {/* Labels next to input nodes */}
      <text x={x1 + 26} y={y1 + 4} fill="currentColor" opacity="0.5" fontSize="11">重量</text>
      <text x={x2 + 26} y={y2 + 4} fill="currentColor" opacity="0.5" fontSize="11">硬度</text>

      {/* Weight arrows x1 → z */}
      <line x1={x1 + 18} y1={y1} x2={xz - 14} y2={yMid - 8} stroke={strokeColor} strokeWidth="1.5" markerEnd="url(#arrowGreen)" />
      <text x={(x1 + xz) / 2 - 10} y={yMid - 28} fill={strokeColor} opacity="0.8" fontSize="11" fontFamily="monospace">w₁</text>

      {/* Weight arrow x2 → z */}
      <line x1={x2 + 18} y1={y2} x2={xz - 14} y2={yMid + 8} stroke={strokeColor} strokeWidth="1.5" markerEnd="url(#arrowGreen)" />
      <text x={(x2 + xz) / 2 - 10} y={yMid + 28} fill={strokeColor} opacity="0.8" fontSize="11" fontFamily="monospace">w₂</text>

      {/* Sum node */}
      <circle cx={xz} cy={yMid} r="22" fill="none" stroke={strokeColor} strokeWidth="2" />
      <text x={xz} y={yMid - 4} textAnchor="middle" fill="white" fontSize="10" fontFamily="monospace">z = Σwᵢxᵢ</text>
      <text x={xz} y={yMid + 12} textAnchor="middle" fill="white" opacity="0.5" fontSize="9">+ b</text>

      {/* Bias indicator */}
      <text x={xz} y={yMid - 36} textAnchor="middle" fill="currentColor" opacity="0.4" fontSize="11" fontFamily="monospace">b</text>

      {/* Arrow z → sigmoid */}
      <line x1={xz + 22} y1={yMid} x2={xy - 18} y2={yMid} stroke={strokeColor} strokeWidth="1.5" markerEnd="url(#arrowGreen)" />

      {/* Sigmoid output node */}
      <rect x={xy - 18} y={yMid - 22} width={36} height={44} rx="8" fill="none" stroke={strokeColor} strokeWidth="2" />
      <text x={xy} y={yMid - 4} textAnchor="middle" fill="white" fontSize="9" fontFamily="monospace">σ(z)</text>
      <text x={xy} y={yMid + 13} textAnchor="middle" fill="white" opacity="0.6" fontSize="9">ŷ</text>

      {/* Arrowheads def */}
      <defs>
        <marker id="arrowGreen" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={strokeColor} />
        </marker>
      </defs>

      {/* Bottom annotation */}
      <text x={xy} y={yMid + 52} textAnchor="middle" fill="currentColor" opacity="0.35" fontSize="11">输出概率 (0 ~ 1)</text>
    </svg>
  );
}
