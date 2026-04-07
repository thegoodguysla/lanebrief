import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

async function getSharedReport(token: string) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "https://lanebrief.com";
  const res = await fetch(`${baseUrl}/api/reports/shared/${token}`, {
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json() as Promise<{
    referrerEmail: string | null;
    expiresAt: string;
    reportHtml: string;
    laneCount: number;
  }>;
}

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const data = await getSharedReport(token);
  if (!data) return { title: "Report not found | LaneBrief" };
  return {
    title: "LaneBrief Freight Intelligence Report",
    description: "A personalized weekly freight market brief shared via LaneBrief — rate trends, carrier recommendations, and capacity signals.",
  };
}

export default async function SharedReportPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const data = await getSharedReport(token);

  if (!data) {
    notFound();
  }

  const expiresAt = new Date(data.expiresAt);
  const isExpired = expiresAt < new Date();

  if (isExpired) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-4">
        <div className="max-w-md text-center space-y-4">
          <p className="text-4xl">⏰</p>
          <h1 className="text-xl font-semibold">This report link has expired</h1>
          <p className="text-muted-foreground text-sm">
            Shared report links are valid for 7 days. Ask your colleague to send a new one, or get your own free report.
          </p>
          <Link
            href="/sign-up"
            className="inline-block rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Get your free weekly report →
          </Link>
        </div>
      </div>
    );
  }

  const weekOf = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="border-b border-border/60 bg-background/95 backdrop-blur sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="font-semibold tracking-tight">
            LaneBrief
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/sign-in" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Sign in
            </Link>
            <Link
              href="/sign-up"
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Get free report
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-4 py-10 space-y-8">
        {/* Shared-by banner */}
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-5 py-4 text-center space-y-1">
          <p className="text-sm font-semibold text-blue-800">
            📩 A colleague shared this freight intelligence report with you
          </p>
          <p className="text-xs text-blue-600">
            Week of {weekOf} · {data.laneCount} lane{data.laneCount !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Header */}
        <div className="space-y-3">
          <h1 className="text-2xl font-bold tracking-tight">
            Weekly Freight Intelligence Report
          </h1>
          <p className="text-muted-foreground leading-relaxed">
            LaneBrief delivers personalized freight market intelligence every Monday — rate trends,
            carrier recommendations, and capacity signals for your specific lanes.
          </p>
        </div>

        {/* Report content */}
        <div
          className="rounded-lg border border-border overflow-hidden"
          dangerouslySetInnerHTML={{ __html: data.reportHtml }}
        />

        {/* CTA */}
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-6 text-center space-y-3">
          <p className="font-semibold">Want reports like this for your lanes?</p>
          <p className="text-sm text-muted-foreground">
            Get your own personalized weekly freight market brief — free. No credit card required.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/sign-up"
              className="inline-block rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Start free → lanebrief.com/sign-up
            </Link>
            <Link
              href="/weekly-report"
              className="inline-block rounded-lg border border-border px-6 py-2.5 text-sm font-medium hover:bg-muted/50 transition-colors"
            >
              See sample report
            </Link>
          </div>
        </div>

        {/* Social share */}
        <div className="flex flex-col gap-2">
          <p className="text-xs text-muted-foreground text-center font-medium uppercase tracking-wide">Share this report</p>
          <div className="flex gap-2 justify-center flex-wrap">
            <a
              href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(`https://lanebrief.com/reports/shared/${token}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted/50 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
              LinkedIn
            </a>
            <a
              href={`https://twitter.com/intent/tweet?text=${encodeURIComponent("Check out this week's freight market intelligence from LaneBrief")}&url=${encodeURIComponent(`https://lanebrief.com/reports/shared/${token}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted/50 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.741l7.73-8.835L1.254 2.25H8.08l4.265 5.638L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z"/></svg>
              Post on X
            </a>
            <button
              onClick={() => navigator.clipboard.writeText(`https://lanebrief.com/reports/shared/${token}`)}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted/50 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
              Copy link
            </button>
          </div>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Rates are AI-estimated. This report was shared via LaneBrief and expires {expiresAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}.
        </p>
      </main>
    </div>
  );
}
