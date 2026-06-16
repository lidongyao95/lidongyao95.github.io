export default function TrainingInferenceFlow() {
  const W = 600;
  const H = 480;

  const accent = 'var(--accent, #00ff88)';
  const dim = 'rgba(255,255,255,0.15)';
  const dimText = 'rgba(255,255,255,0.5)';

  // Box dimensions
  const bx = (x) => x;
  const bw = 140;
  const bh = 36;
  const rx = 6;

  // ---- TRAINING SIDE (left) ----
  const tLeft = 30;
  const tCenter = tLeft + bw / 2;

  const trainingSteps = [
    { y: 40, text: '输入 x', color: dim, arrow: true },
    { y: 90, text: '前向传播', color: accent, opacity: 0.3, arrow: true },
    { y: 140, text: '预测 ŷ', color: dim, arrow: true },
    { y: 190, text: '计算损失 L(ŷ, y)', color: accent, opacity: 0.5, arrow: true },
    { y: 240, text: '反向传播 ∂L/∂w', color: accent, opacity: 0.7, arrow: true },
    { y: 290, text: '更新权重 w -= α·∇L', color: accent, opacity: 0.9, arrow: true },
  ];

  // Training boxes
  trainingSteps.forEach((s, i) => {
    const isFirst = i === 0;
    const fill = s.color === accent ? accent : 'none';
    const opacity = s.opacity || (s.color === accent ? 0.15 : 0);

    // Box
    return (
      <rect key={`tb-${i}`} x={tLeft} y={s.y} width={bw} height={bh} rx={rx} fill={fill} fillOpacity={opacity} stroke={s.color} strokeWidth="1.2" />
    );
  });

  // Training text labels
  trainingSteps.forEach((s, i) => (
    <text key={`tt-${i}`} x={tCenter} y={s.y + bh / 2 + 5} textAnchor="middle" fill="white" fontSize="13">{s.text}</text>
  ));

  // Training arrows (between boxes)
  trainingSteps.slice(0, -1).forEach((s, i) => {
    const ay1 = s.y + bh;
    const ay2 = trainingSteps[i + 1].y;
    return (
      <line key={`ta-${i}`} x1={tCenter} y1={ay1} x2={tCenter} y2={ay2} stroke={accent} strokeOpacity="0.5" strokeWidth="1.2" markerEnd="url(#arrAccent)" />
    );
  });

  // Loop-back arrow
  const lastY = trainingSteps[trainingSteps.length - 1].y;
  const firstY = trainingSteps[0].y;
  const loopPath = `M${tCenter},${lastY + bh} L${tCenter},${lastY + bh + 20} L${tLeft - 20},${lastY + bh + 20} L${tLeft - 20},${firstY + bh / 2} L${tLeft},${firstY + bh / 2}`;

  // Loop label
  const loopLabel = (
    <text x={tLeft - 26} y={lastY + bh + 14} textAnchor="end" fill={accent} opacity="0.6" fontSize="11">↻ 重复直到收敛</text>
  );

  // ---- INFERENCE SIDE (right) ----
  const iLeft = 370;
  const iCenter = iLeft + bw / 2;

  const inferenceSteps = [
    { y: 130, text: '新输入 x', color: dim },
    { y: 180, text: '前向传播', color: accent, opacity: 0.3 },
    { y: 230, text: '输出 ŷ', color: dim },
    { y: 280, text: 'ŷ > 0.5 ?  → 分类结果', color: accent, opacity: 0.5 },
  ];

  // Inference boxes
  inferenceSteps.forEach((s, i) => {
    const fill = s.color === accent ? accent : 'none';
    const opacity = s.opacity || (s.color === accent ? 0.12 : 0);

    return (
      <rect key={`ib-${i}`} x={iLeft} y={s.y} width={bw} height={bh} rx={rx} fill={fill} fillOpacity={opacity} stroke={s.color} strokeWidth="1.2" />
    );
  });

  // Inference text labels
  inferenceSteps.forEach((s, i) => (
    <text key={`it-${i}`} x={iCenter} y={s.y + bh / 2 + 5} textAnchor="middle" fill="white" fontSize="13">{s.text}</text>
  ));

  // Inference arrows
  inferenceSteps.slice(0, -1).forEach((s, i) => {
    const ay1 = s.y + bh;
    const ay2 = inferenceSteps[i + 1].y;
    return (
      <line key={`ia-${i}`} x1={iCenter} y1={ay1} x2={iCenter} y2={ay2} stroke={accent} strokeOpacity="0.35" strokeWidth="1.2" markerEnd="url(#arrAccent2)" />
    );
  });

  // Side labels
  const textProps = [
    { text: '训练阶段', x: tCenter, y: H - 14, opacity: 0.6 },
    { text: '推理阶段', x: iCenter, y: H - 14, opacity: 0.6 },
  ];

  // Inference annotation
  const annotation = (
    <text x={iCenter} y={inferenceSteps[inferenceSteps.length - 1].y + bh + 22} textAnchor="middle" fill={dimText} fontSize="11">一次正向计算，没有反向</text>
  );

  return (
    <svg viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg" class="w-full max-w-xl mx-auto">
      <defs>
        <marker id="arrAccent" viewBox="0 0 8 8" refX="4" refY="7" markerWidth="5" markerHeight="5" orient="auto">
          <path d="M 0 0 L 4 8 L 8 0 z" fill={accent} opacity="0.5" />
        </marker>
        <marker id="arrAccent2" viewBox="0 0 8 8" refX="4" refY="7" markerWidth="5" markerHeight="5" orient="auto">
          <path d="M 0 0 L 4 8 L 8 0 z" fill={accent} opacity="0.35" />
        </marker>
      </defs>

      {/* Title labels */}
      <text x={tCenter} y={18} textAnchor="middle" fill="white" fontSize="15" fontWeight="bold">🔄 训练</text>
      <text x={iCenter} y={18} textAnchor="middle" fill="white" fontSize="15" fontWeight="bold">⚡ 推理</text>

      {/* Divider */}
      <line x1={W / 2} y1={28} x2={W / 2} y2={H - 20} stroke={dim} strokeWidth="1" strokeDasharray="6,4" />

      {/* Training boxes + text */}
      {trainingSteps.map((s, i) => {
        const fill = s.color === accent ? accent : 'none';
        const opacity = s.opacity || (s.color === accent ? 0.15 : 0);
        return (
          <g key={`tg-${i}`}>
            <rect x={tLeft} y={s.y} width={bw} height={bh} rx={rx} fill={fill} fillOpacity={opacity} stroke={s.color} strokeWidth="1.2" />
            <text x={tCenter} y={s.y + bh / 2 + 5} textAnchor="middle" fill="white" fontSize="13">{s.text}</text>
          </g>
        );
      })}

      {/* Training arrows */}
      {trainingSteps.slice(0, -1).map((s, i) => (
        <line key={`ta-${i}`} x1={tCenter} y1={s.y + bh} x2={tCenter} y2={trainingSteps[i + 1].y} stroke={accent} strokeOpacity="0.5" strokeWidth="1.2" markerEnd="url(#arrAccent)" />
      ))}

      {/* Loop back */}
      <path d={loopPath} fill="none" stroke={accent} strokeOpacity="0.35" strokeWidth="1.2" strokeDasharray="5,3" markerEnd="url(#arrAccent)" />
      <text x={tLeft - 26} y={lastY + bh + 14} textAnchor="end" fill={accent} opacity="0.6" fontSize="11">↻ 重复直到收敛</text>

      {/* Inference boxes + text */}
      {inferenceSteps.map((s, i) => {
        const fill = s.color === accent ? accent : 'none';
        const opacity = s.opacity || (s.color === accent ? 0.12 : 0);
        return (
          <g key={`ig-${i}`}>
            <rect x={iLeft} y={s.y} width={bw} height={bh} rx={rx} fill={fill} fillOpacity={opacity} stroke={s.color} strokeWidth="1.2" />
            <text x={iCenter} y={s.y + bh / 2 + 5} textAnchor="middle" fill="white" fontSize="13">{s.text}</text>
          </g>
        );
      })}

      {/* Inference arrows */}
      {inferenceSteps.slice(0, -1).map((s, i) => (
        <line key={`ia-${i}`} x1={iCenter} y1={s.y + bh} x2={iCenter} y2={inferenceSteps[i + 1].y} stroke={accent} strokeOpacity="0.35" strokeWidth="1.2" markerEnd="url(#arrAccent2)" />
      ))}

      {/* Annotation */}
      <text x={iCenter} y={inferenceSteps[inferenceSteps.length - 1].y + bh + 22} textAnchor="middle" fill={dimText} fontSize="11">一次正向计算，没有反向</text>

      {/* Side labels */}
      <text x={tCenter} y={H - 14} textAnchor="middle" fill="white" opacity="0.6" fontSize="12">训练阶段（循环执行）</text>
      <text x={iCenter} y={H - 14} textAnchor="middle" fill="white" opacity="0.6" fontSize="12">推理阶段（单次执行）</text>
    </svg>
  );
}
