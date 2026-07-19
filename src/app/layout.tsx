import type { Metadata } from "next";
import { Geist, Geist_Mono, Space_Grotesk, IBM_Plex_Sans, Fraunces, Source_Sans_3 } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// BoneBot brand type: Space Grotesk for headings/
// wordmark/buttons/stats, IBM Plex Sans for everything else. Self-hosted via
// next/font — no runtime Google Fonts request, unlike the design prototype's
// CDN <link>.
const heading = Space_Grotesk({
  variable: "--font-heading",
  weight: ["500", "700"],
  subsets: ["latin"],
});

const body = IBM_Plex_Sans({
  variable: "--font-body",
  weight: ["400", "500", "600"],
  subsets: ["latin"],
});

// Editorial redesign type, scoped to the landing page only (src/app/page.tsx
// "landing" screen) — Fraunces serif headlines + Source Sans 3 body, kept
// separate from the heading/body vars above so chat/results are unaffected.
const fraunces = Fraunces({
  variable: "--font-fraunces",
  weight: "variable",
  style: ["normal", "italic"],
  axes: ["opsz", "SOFT", "WONK"],
  subsets: ["latin"],
});

const sourceSans = Source_Sans_3({
  variable: "--font-source-sans",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BoneBot",
  description: "Hormone-aware bone-health screening for postmenopausal women — Hack-Nation Challenge 05.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${heading.variable} ${body.variable} ${fraunces.variable} ${sourceSans.variable} h-full antialiased`}
    >
      <body className="h-full flex flex-col overflow-hidden">{children}</body>
    </html>
  );
}
