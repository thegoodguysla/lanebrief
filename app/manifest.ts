import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LaneBrief — Freight Intelligence",
    short_name: "LaneBrief",
    description:
      "AI-powered freight intelligence briefs — lane analysis, rate forecasts, and market data for independent brokers.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#0D1F3C",
    theme_color: "#0D1F3C",
    orientation: "portrait",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
