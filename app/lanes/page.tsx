import type { Metadata } from "next";
import Link from "next/link";
import { CORRIDORS, cityName } from "@/lib/corridors";

export const metadata: Metadata = {
  title: "Freight Lane Rates Directory | LaneBrief",
  description:
    "Browse current spot rates, 7-day forecasts, and carrier capacity for 500+ US freight corridors. Updated daily.",
  alternates: { canonical: "https://lanebrief.com/lanes" },
};

// Group corridors by origin city for display
function groupByOrigin(corridors: typeof CORRIDORS) {
  const map = new Map<string, typeof CORRIDORS[number][]>();
  for (const c of corridors) {
    const key = c.origin;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(c);
  }
  return map;
}

export default function LanesIndexPage() {
  const grouped = groupByOrigin(CORRIDORS);
  const origins = [...grouped.keys()].sort();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="border-b border-border/60 bg-background/95 backdrop-blur sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="font-semibold tracking-tight">
            LaneBrief
          </Link>
          <Link
            href="/sign-up"
            className="text-sm bg-primary text-primary-foreground rounded-md px-3 py-1.5 hover:bg-primary/90 transition-colors"
          >
            Free sign-up
          </Link>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Link href="/" className="hover:text-foreground">Home</Link>
            <span>/</span>
            <span className="text-foreground">Freight Lanes</span>
          </nav>
          <h1 className="text-3xl font-bold tracking-tight">US Freight Lane Rates Directory</h1>
          <p className="text-muted-foreground max-w-2xl">
            Current spot rates, 7-day forecasts, and carrier capacity for {CORRIDORS.length}+ US freight corridors.
            Each page is updated daily from live market data.
          </p>
        </div>

        {/* CTA */}
        <div className="rounded-xl border border-primary/20 bg-primary/5 px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <div>
            <p className="font-semibold text-sm">Track your lanes in real time</p>
            <p className="text-xs text-muted-foreground">Get daily rate alerts, AI briefs, and carrier risk scores — free for up to 3 lanes.</p>
          </div>
          <Link
            href="/sign-up"
            className="shrink-0 inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Start free
          </Link>
        </div>

        {/* Directory grouped by origin */}
        <div className="space-y-8">
          {origins.map((origin) => {
            const dests = grouped.get(origin)!;
            return (
              <section key={origin} aria-labelledby={`origin-${origin}`}>
                <h2
                  id={`origin-${origin}`}
                  className="text-base font-semibold mb-3 pb-1.5 border-b border-border/60"
                >
                  From {cityName(origin)}
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                  {dests.map((c) => (
                    <Link
                      key={c.slug}
                      href={`/lanes/${c.slug}`}
                      className="rounded-lg border border-border bg-card px-3 py-2 text-sm hover:border-primary/40 hover:bg-primary/5 transition-colors truncate"
                    >
                      {cityName(c.destination)}
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </main>
    </div>
  );
}
