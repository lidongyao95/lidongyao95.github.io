export default function SigmoidCurve() {
  const W = 480;
  const H = 260;
  const pad = { top: 30, right: 40, bottom: 50, left: 60 };
  const pw = W - pad.left - pad.right;
  const ph = H - pad.top - pad.bottom;

  // Map data space (-6 to 6 in x, 0 to 1 in y) to pixel space
  const xToPx = (x) => pad.left + ((x + 6) / 12) * pw;
  const yToPx = (y) => pad.top + (1 - y) * ph;
  const sigmoid = (z) => 1 / (1 + Math.exp(-z));

  // Generate smooth path
  const points = [];
  for (let i = 0; i <= 100; i++) {
    const z = -6 + (i / 100) * 12;
    points.push({ x: xToPx(z), y: yToPx(sigmoid(z)) });
  }
  const pathD = points.map((p, i) => (i === 0 ? `M${p.x},${p.y}` : `L${p.x},${p.y}`)).join(' ');

  // Ticks
  const xTicks = [-6, -4, -2, 0, 2, 4, 6];
  const yTicks = [0, 0.25, 0.5, 0.75, 1.0];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg" class="w-full max-w-lg mx-auto">
      <defs>
        <linearGradient id="sg" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="currentColor" stopOpacity="0.1" />
          <stop offset="0.5" stopColor="var(--accent, #00ff88)" stopOpacity="0.3" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0.1" />
        </linearGradient>
        <clipPath id="plotClip">
          <rect x={pad.left} y={pad.top} width={pw} height={ph} />
        </clipPath>
      </defs>

      {/* Background grid lines */}
      {yTicks.map((y) => (
        <line key={`gy-${y}`} x1={pad.left} y1={yToPx(y)} x2={pad.left + pw} y2={yToPx(y)} stroke="currentColor" strokeOpacity="0.08" />
      ))}

      {/* X axis */}
      <line x1={pad.left} y1={yToPx(0)} x2={pad.left + pw} y2={yToPx(0)} stroke="currentColor" strokeOpacity="0.3" />
      {/* Y axis */}
      <line x1={xToPx(0)} y1={pad.top} x2={xToPx(0)} y2={pad.top + ph} stroke="currentColor" strokeOpacity="0.3" />

      {/* Sigmoid curve */}
      <path d={pathD} fill="none" stroke="var(--accent, #00ff88)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

      {/* Dashed y=0.5 line */}
      <line x1={pad.left} y1={yToPx(0.5)} x2={pad.left + pw} y2={yToPx(0.5)} stroke="currentColor" strokeOpacity="0.12" strokeDasharray="4,4" />

      {/* X tick labels */}
      {xTicks.map((x) => (
        <text key={`tx-${x}`} x={xToPx(x)} y={yToPx(0) + 20} textAnchor="middle" fill="currentColor" opacity="0.5" fontSize="12">
          {x}
        </text>
      ))}

      {/* Y tick labels */}
      {yTicks.map((y) => (
        <text key={`ty-${y}`} x={pad.left - 10} y={yToPx(y) + 4} textAnchor="end" fill="currentColor" opacity="0.5" fontSize="12">
          {y.toFixed(y === 0.5 ? 1 : 0)}
        </text>
      ))}

      {/* Axis labels */}
      <text x={pad.left + pw / 2} y={H - 8} textAnchor="middle" fill="currentColor" opacity="0.7" fontSize="13">z</text>
      <text x={14} y={pad.top + ph / 2} textAnchor="middle" fill="currentColor" opacity="0.7" fontSize="13" transform={`rotate(-90, 14, ${pad.top + ph / 2})`}>σ(z)</text>

      {/* Annotation: z=0 → σ=0.5 */}
      <circle cx={xToPx(0)} cy={yToPx(0.5)} r="5" fill="var(--accent, #00ff88)" opacity="0.6" />
    </svg>
  );
}
