import type { Metadata } from "next";
import { Geist, Geist_Mono, Space_Grotesk, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// BoneWise brand type (design_handoff_bonewise): Space Grotesk for headings/
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

export const metadata: Metadata = {
  title: "BoneWise",
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
      className={`${geistSans.variable} ${geistMono.variable} ${heading.variable} ${body.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
