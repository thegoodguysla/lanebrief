import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Free Lane Health Check — LaneBrief",
  description:
    "Enter your 3 most-run lanes. We'll tell you if you're above or below market, and where you're leaving money on the table. Free. No credit card.",
  alternates: {
    canonical: "https://lanebrief.com/free",
  },
  openGraph: {
    title: "Free Lane Health Check — LaneBrief",
    description:
      "Enter your top 3 lanes. Get a free AI-generated intelligence brief — rate trends, capacity signals, and seasonal risks. No credit card.",
    url: "https://lanebrief.com/free",
    siteName: "LaneBrief",
    type: "website",
  },
};

export default function FreeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
