import type { MetadataRoute } from "next";
import { CORRIDORS } from "@/lib/corridors";
import { BLOG_POSTS } from "@/lib/blog";

const VS_SLUGS = ["freightwaves", "dat-market-conditions", "truckstop"];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    { url: "https://lanebrief.com", lastModified: now, changeFrequency: "monthly", priority: 1 },
    { url: "https://lanebrief.com/free", lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: "https://lanebrief.com/calculate", lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: "https://lanebrief.com/lanes", lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: "https://lanebrief.com/vs", lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: "https://lanebrief.com/blog", lastModified: now, changeFrequency: "weekly", priority: 0.8 },
  ];

  const blogPages: MetadataRoute.Sitemap = BLOG_POSTS.map((post) => ({
    url: `https://lanebrief.com/blog/${post.slug}`,
    lastModified: new Date(post.updatedAt),
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  const lanePages: MetadataRoute.Sitemap = CORRIDORS.map((c) => ({
    url: `https://lanebrief.com/lanes/${c.slug}`,
    lastModified: now,
    changeFrequency: "daily" as const,
    priority: 0.7,
  }));

  const vsPages: MetadataRoute.Sitemap = VS_SLUGS.map((slug) => ({
    url: `https://lanebrief.com/vs/${slug}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.8,
  }));

  return [...staticPages, ...blogPages, ...lanePages, ...vsPages];
}
