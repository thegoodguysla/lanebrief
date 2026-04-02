import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: "https://lanebrief.com/sitemap.xml",
    host: "https://lanebrief.com",
  };
}
