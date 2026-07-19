// FemurGauge — a stylized femur whose color tracks the estimated T-score
// band (same color the results screen already uses for the band label), and
// whose "porosity" (pale holes in the bone) grows as the estimate moves
// toward the osteoporosis range. Purely presentational: the T-score and
// band color are computed elsewhere and passed in — this never re-derives
// or re-thresholds anything.

// Fixed scatter of candidate pores (in viewBox units, all inside the bone
// outline). How many show — and how large — is driven by severity below.
// A fixed list (not random) keeps the render stable across re-renders.
const PORES: { cx: number; cy: number; r: number }[] = [
  { cx: 38, cy: 34, r: 4.5 },
  { cx: 52, cy: 44, r: 3 },
  { cx: 104, cy: 44, r: 3.5 },
  { cx: 72, cy: 78, r: 3 },
  { cx: 66, cy: 108, r: 3.5 },
  { cx: 76, cy: 136, r: 3 },
  { cx: 64, cy: 160, r: 3.5 },
  { cx: 74, cy: 190, r: 3 },
  { cx: 52, cy: 208, r: 4 },
  { cx: 90, cy: 210, r: 4.5 },
  { cx: 28, cy: 44, r: 3 },
  { cx: 82, cy: 96, r: 2.5 },
  { cx: 58, cy: 128, r: 2.5 },
  { cx: 86, cy: 168, r: 3 },
];

// 0 at T = -0.5 or better (dense, solid bone) → 1 at T = -3.0 or worse.
function severityFor(tScore: number): number {
  return Math.max(0, Math.min(1, (-tScore - 0.5) / 2.5));
}

export default function FemurGauge({
  tScore,
  color,
  bandLabel,
  className,
}: {
  tScore: number;
  color: string;
  bandLabel: string;
  className?: string;
}) {
  const severity = severityFor(tScore);
  const poresShown = Math.round(severity * PORES.length);
  const poreScale = 0.7 + severity * 0.5;

  return (
    <svg
      viewBox="0 0 140 240"
      className={className}
      role="img"
      aria-label={`Bone illustration colored for the ${bandLabel} band, estimated T-score ${tScore.toFixed(1)}`}
    >
      <title>{`Estimated T-score ${tScore.toFixed(1)} — ${bandLabel}`}</title>
      {/* Stylized femur: head (top left), greater trochanter (top right),
          shaft, and the two condyles at the knee end. */}
      <path
        d="M 30 14
           C 15 18, 8 34, 14 48
           C 18 58, 28 64, 40 62
           C 52 70, 60 78, 66 88
           C 60 120, 58 150, 54 178
           C 40 186, 32 196, 34 208
           C 36 222, 50 228, 62 222
           C 68 218, 74 218, 80 222
           C 92 228, 106 222, 108 208
           C 110 196, 102 186, 90 178
           C 86 150, 86 120, 88 92
           C 96 84, 104 76, 108 64
           C 116 60, 122 48, 118 36
           C 114 26, 102 24, 94 30
           C 84 36, 74 38, 64 34
           C 56 22, 44 12, 30 14 Z"
        fill={color}
        fillOpacity={0.82}
        stroke="#221B16"
        strokeOpacity={0.55}
        strokeWidth={3}
        strokeLinejoin="round"
        style={{ transition: "fill 0.6s ease" }}
      />
      {/* Porosity: pale holes that appear as the estimate worsens. */}
      {PORES.slice(0, poresShown).map((p, i) => (
        <circle key={i} cx={p.cx} cy={p.cy} r={p.r * poreScale} fill="#FAF7F2" fillOpacity={0.9} />
      ))}
    </svg>
  );
}
