import type { Metadata } from "next";
import { LandingHero } from "@/components/LandingHero";

export const metadata: Metadata = {
  title: "Git Forest",
  description: "Turn any public GitHub profile into an explorable pixel-art forest.",
};

export default function HomePage() {
  return <LandingHero />;
}
