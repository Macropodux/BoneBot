// Shared "warm editorial health journal" design tokens — Fraunces serif +
// Source Sans 3 body, cream/hairline palette. Originally scoped to the
// landing screen only; now the app-wide look (see src/app/page.tsx and
// src/app/VoiceScreen.tsx). Fonts are registered in src/app/layout.tsx as
// --font-fraunces / --font-source-sans.

export const THEME = {
  bg: "#FAF7F2",
  bandBg: "#F5F0E7",
  border: "#E7DFD3",
  borderInput: "#E0D6C6",
  borderSecondary: "#C9BFAF",
  ink: "#221B16",
  body: "#55493E",
  bodyPrimary: "#2A2320",
  muted: "#8A7E6E",
  ornament: "#B3A692",
  accent: "#0E6E62",
  accentHover: "#0A5148",
  disclaimerBg: "#2A2320",
  disclaimerSub: "#BFB4A4",
} as const;

export const HEADING_FONT = "font-[family-name:var(--font-fraunces)]";
export const BODY_FONT = "font-[family-name:var(--font-source-sans)]";
