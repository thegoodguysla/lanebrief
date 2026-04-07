import type { Metadata } from "next";
import Link from "next/link";
import { BLOG_POSTS } from "@/lib/blog";

export const metadata: Metadata = {
  title: "Freight Intelligence Blog | LaneBrief",
  description:
    "Expert freight market analysis, rate forecasts, and intelligence for independent freight brokers. Covering spot rates, lane trends, carrier fraud, and market outlook.",
  alternates: { canonical: "https://lanebrief.com/blog" },
  openGraph: {
    title: "Freight Intelligence Blog | LaneBrief",
    description:
      "Expert freight market analysis, rate forecasts, and intelligence for independent freight brokers.",
    url: "https://lanebrief.com/blog",
    siteName: "LaneBrief",
    type: "website",
  },
};

const CATEGORY_COLORS: Record<string, string> = {
  "Freight Pricing": "bg-blue-100 text-blue-700",
  "Market Intelligence": "bg-amber-100 text-amber-700",
  "Tools & Software": "bg-emerald-100 text-emerald-700",
  "Risk Management": "bg-red-100 text-red-700",
  "Market Forecasts": "bg-purple-100 text-purple-700",
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default function BlogIndexPage() {
  const [featured, ...rest] = BLOG_POSTS;

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-100 bg-white">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="font-bold text-gray-900 text-lg">
            LaneBrief
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/lanes" className="text-sm text-gray-600 hover:text-gray-900">
              Lane Rates
            </Link>
            <Link
              href="/sign-up"
              className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              Try free
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-12">
        <div className="mb-12">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Freight Intelligence Blog</h1>
          <p className="text-gray-500 text-lg">
            Rate analysis, market forecasts, and practical guides for independent freight brokers.
          </p>
        </div>

        {/* Featured post */}
        <Link
          href={`/blog/${featured.slug}`}
          className="block mb-12 group"
        >
          <article className="border border-gray-200 rounded-2xl p-8 hover:border-blue-300 hover:shadow-md transition-all">
            <div className="flex items-center gap-3 mb-4">
              <span
                className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                  CATEGORY_COLORS[featured.category] ?? "bg-gray-100 text-gray-600"
                }`}
              >
                {featured.category}
              </span>
              <span className="text-xs text-gray-400">{featured.readingTime}</span>
              <span className="text-xs text-gray-400">·</span>
              <span className="text-xs text-gray-400">{formatDate(featured.publishedAt)}</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3 group-hover:text-blue-600 transition-colors leading-tight">
              {featured.title}
            </h2>
            <p className="text-gray-600 leading-relaxed mb-4">{featured.excerpt}</p>
            <span className="text-blue-600 text-sm font-medium group-hover:underline">
              Read article →
            </span>
          </article>
        </Link>

        {/* Rest of posts */}
        <div className="grid gap-6 md:grid-cols-2">
          {rest.map((post) => (
            <Link key={post.slug} href={`/blog/${post.slug}`} className="group">
              <article className="border border-gray-200 rounded-xl p-6 hover:border-blue-300 hover:shadow-sm transition-all h-full flex flex-col">
                <div className="flex items-center gap-2 mb-3">
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      CATEGORY_COLORS[post.category] ?? "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {post.category}
                  </span>
                  <span className="text-xs text-gray-400">{post.readingTime}</span>
                </div>
                <h2 className="text-base font-bold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors leading-snug">
                  {post.title}
                </h2>
                <p className="text-sm text-gray-500 leading-relaxed flex-1">{post.excerpt}</p>
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-xs text-gray-400">{formatDate(post.publishedAt)}</span>
                  <span className="text-blue-600 text-xs font-medium group-hover:underline">
                    Read →
                  </span>
                </div>
              </article>
            </Link>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-16 bg-gray-50 rounded-2xl p-8 text-center border border-gray-100">
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            Track the lanes that matter to you
          </h2>
          <p className="text-gray-500 mb-6 max-w-md mx-auto">
            LaneBrief monitors your specific lanes and delivers weekly rate intelligence, forecasts,
            and alerts directly to your inbox.
          </p>
          <Link
            href="/sign-up"
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors"
          >
            Start free → lanebrief.com
          </Link>
        </div>
      </main>

      <footer className="border-t border-gray-100 mt-16 py-8">
        <div className="max-w-4xl mx-auto px-4 flex flex-wrap gap-4 text-sm text-gray-400">
          <Link href="/" className="hover:text-gray-600">
            Home
          </Link>
          <Link href="/lanes" className="hover:text-gray-600">
            Lane Rates
          </Link>
          <Link href="/pricing" className="hover:text-gray-600">
            Pricing
          </Link>
          <Link href="/blog" className="hover:text-gray-600">
            Blog
          </Link>
          <Link href="/privacy" className="hover:text-gray-600">
            Privacy
          </Link>
        </div>
      </footer>
    </div>
  );
}
