import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getBlogPost, getAllBlogSlugs, BLOG_POSTS } from "@/lib/blog";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return getAllBlogSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) return {};

  return {
    title: post.metaTitle,
    description: post.metaDescription,
    alternates: { canonical: `https://lanebrief.com/blog/${slug}` },
    openGraph: {
      title: post.metaTitle,
      description: post.metaDescription,
      url: `https://lanebrief.com/blog/${slug}`,
      siteName: "LaneBrief",
      type: "article",
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt,
    },
  };
}

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

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) notFound();

  const related = BLOG_POSTS.filter(
    (p) => p.slug !== slug && p.category === post.category
  ).slice(0, 2);

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.metaDescription,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt,
    author: { "@type": "Organization", name: "LaneBrief", url: "https://lanebrief.com" },
    publisher: { "@type": "Organization", name: "LaneBrief", url: "https://lanebrief.com" },
    mainEntityOfPage: { "@type": "WebPage", "@id": `https://lanebrief.com/blog/${slug}` },
  };

  return (
    <div className="min-h-screen bg-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />

      <header className="border-b border-gray-100 bg-white sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="font-bold text-gray-900 text-lg">
            LaneBrief
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/blog" className="text-sm text-gray-500 hover:text-gray-900">
              ← Blog
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

      <main className="max-w-2xl mx-auto px-4 py-12">
        {/* Article header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <span
              className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                CATEGORY_COLORS[post.category] ?? "bg-gray-100 text-gray-600"
              }`}
            >
              {post.category}
            </span>
            <span className="text-xs text-gray-400">{post.readingTime}</span>
            <span className="text-xs text-gray-400">·</span>
            <time className="text-xs text-gray-400" dateTime={post.publishedAt}>
              {formatDate(post.publishedAt)}
            </time>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 leading-tight mb-4">
            {post.title}
          </h1>
          <p className="text-lg text-gray-500 leading-relaxed">{post.excerpt}</p>
        </div>

        <hr className="border-gray-100 mb-8" />

        {/* Article content */}
        <article
          className="prose prose-gray max-w-none
            prose-headings:font-bold prose-headings:text-gray-900
            prose-h2:text-2xl prose-h2:mt-10 prose-h2:mb-4
            prose-h3:text-lg prose-h3:mt-6 prose-h3:mb-2
            prose-p:text-gray-700 prose-p:leading-relaxed prose-p:mb-4
            prose-ul:text-gray-700 prose-ul:my-4 prose-ul:pl-6
            prose-ol:text-gray-700 prose-ol:my-4 prose-ol:pl-6
            prose-li:mb-2
            prose-strong:text-gray-900
            prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline"
          dangerouslySetInnerHTML={{ __html: post.content }}
        />

        <hr className="border-gray-100 my-12" />

        {/* CTA */}
        <div className="bg-blue-50 rounded-2xl p-8 text-center border border-blue-100 mb-12">
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            Get lane-level freight intelligence
          </h2>
          <p className="text-gray-500 mb-6 max-w-sm mx-auto text-sm leading-relaxed">
            LaneBrief monitors your specific lanes and delivers weekly rate intelligence, 7-day
            forecasts, and real-time alerts built for independent brokers.
          </p>
          <Link
            href="/sign-up"
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors text-sm"
          >
            Track your lanes free → lanebrief.com
          </Link>
        </div>

        {/* Related posts */}
        {related.length > 0 && (
          <div>
            <h2 className="text-base font-semibold text-gray-500 uppercase tracking-wide mb-4">
              Related Articles
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              {related.map((rp) => (
                <Link key={rp.slug} href={`/blog/${rp.slug}`} className="group">
                  <div className="border border-gray-200 rounded-xl p-5 hover:border-blue-200 hover:shadow-sm transition-all">
                    <p className="text-xs text-gray-400 mb-2">{rp.readingTime}</p>
                    <h3 className="text-sm font-semibold text-gray-900 group-hover:text-blue-600 transition-colors leading-snug">
                      {rp.title}
                    </h3>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-gray-100 mt-8 py-8">
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
