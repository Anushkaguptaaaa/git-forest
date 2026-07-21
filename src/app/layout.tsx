import type { Metadata, Viewport } from "next";
import { Fraunces, DM_Sans, Press_Start_2P } from "next/font/google";
import "./globals.css";

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["600", "700"],
});

const body = DM_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600"],
});

const pixel = Press_Start_2P({
  subsets: ["latin"],
  variable: "--font-pixel",
  weight: ["400"],
});

export const metadata: Metadata = {
  title: {
    default: "Git Forest",
    template: "%s · Git Forest",
  },
  description:
    "A cozy pixel-art forest grown from any public GitHub profile. Every repository becomes a tree.",
  openGraph: {
    title: "Git Forest",
    description: "Explore GitHub profiles as procedurally generated pixel forests.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#1a2e1a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${pixel.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
