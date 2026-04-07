import type { MetadataRoute } from "next";
import { CORRIDORS } from "@/lib/corridors";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    { url: "https://lanebrief.com", lastModified: now, changeFrequency: "monthly", priority: 1 },
    { url: "https://lanebrief.com/free", lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: "https://lanebrief.com/calculate", lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: "https://lanebrief.com/lanes", lastModified: now, changeFrequency: "daily", priority: 0.9 },
  ];

  const lanePages: MetadataRoute.Sitemap = CORRIDORS.map((c) => ({
    url: `https://lanebrief.com/lanes/${c.slug}`,
    lastModified: now,
    changeFrequency: "daily" as const,
    priority: 0.7,
  }));

  return [...staticPages, ...lanePages];
}
