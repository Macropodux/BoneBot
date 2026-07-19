import type { CSSProperties } from "react";

type FloatingBone = {
  id: string;
  left: string;
  top: string;
  width: number;
  rotation: number;
  duration: number;
  delay: number;
  opacity: number;
  tone: "teal" | "coral";
  mobileHidden?: boolean;
};

export const FLOATING_BONES: readonly FloatingBone[] = [
  { id: "top-left", left: "3%", top: "10%", width: 108, rotation: -24, duration: 8.5, delay: -1.2, opacity: 0.13, tone: "teal" },
  { id: "upper-left", left: "14%", top: "28%", width: 68, rotation: 18, duration: 10.5, delay: -4.7, opacity: 0.09, tone: "teal", mobileHidden: true },
  { id: "mid-left", left: "-2%", top: "54%", width: 142, rotation: 34, duration: 12, delay: -7.1, opacity: 0.1, tone: "teal" },
  { id: "lower-left", left: "9%", top: "79%", width: 82, rotation: -12, duration: 9.5, delay: -3.3, opacity: 0.11, tone: "teal", mobileHidden: true },
  { id: "top-right", left: "84%", top: "8%", width: 126, rotation: 22, duration: 11, delay: -5.2, opacity: 0.12, tone: "teal" },
  { id: "upper-right", left: "73%", top: "29%", width: 72, rotation: -30, duration: 8, delay: -2.4, opacity: 0.09, tone: "teal", mobileHidden: true },
  { id: "mid-right", left: "91%", top: "48%", width: 134, rotation: -18, duration: 12.5, delay: -8.6, opacity: 0.1, tone: "teal" },
  { id: "lower-right", left: "80%", top: "72%", width: 96, rotation: 28, duration: 9, delay: -4.1, opacity: 0.14, tone: "coral" },
  { id: "bottom-right", left: "67%", top: "88%", width: 62, rotation: -8, duration: 10, delay: -6.4, opacity: 0.08, tone: "teal", mobileHidden: true },
] as const;

type BoneStyle = CSSProperties & {
  "--bone-rotation": string;
};

export default function FloatingBones() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden select-none"
    >
      <style>{`
        @keyframes bone-float {
          0%, 100% { transform: translate3d(0, 0, 0) rotate(var(--bone-rotation)); }
          50% { transform: translate3d(0, -12px, 0) rotate(calc(var(--bone-rotation) + 3deg)); }
        }
        @media (prefers-reduced-motion: reduce) {
          .floating-bone { animation: none !important; }
        }
      `}</style>
      {FLOATING_BONES.map((bone) => {
        const color = bone.tone === "coral" ? "#B0442F" : "#0E7C6E";
        const style: BoneStyle = {
          left: bone.left,
          top: bone.top,
          width: bone.width,
          color,
          opacity: bone.opacity,
          animation: `bone-float ${bone.duration}s ease-in-out ${bone.delay}s infinite`,
          "--bone-rotation": `${bone.rotation}deg`,
        };

        return (
          <div
            key={bone.id}
            className={`floating-bone absolute ${bone.mobileHidden ? "hidden sm:block" : ""}`}
            style={style}
          >
            <svg viewBox="0 0 120 48" fill="none" role="presentation">
              <path
                d="M25 9C18 2 7 5 7 14c0 6 5 9 9 10-4 1-9 4-9 10 0 9 11 12 18 5h70c7 7 18 4 18-5 0-6-5-9-9-10 4-1 9-4 9-10 0-9-11-12-18-5H25Z"
                fill="rgba(255,255,255,0.42)"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinejoin="round"
              />
              <path d="M31 16h58M31 32h58" stroke="currentColor" strokeWidth="1" opacity="0.35" />
            </svg>
          </div>
        );
      })}
    </div>
  );
}
