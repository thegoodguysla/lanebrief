import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

export const revalidate = 2592000; // 30 days

type CompetitorData = {
  slug: string;
  name: string;
  shortName: string;
  tagline: string;
  pricing: string;
  targetAudience: string;
  description: string;
  features: {
    label: string;
    lanebrief: boolean | string;
    competitor: boolean | string;
  }[];
  switchReasons: string[];
  metaDescription: string;
};

const COMPETITORS: Record<string, CompetitorData> = {
  freightwaves: {
    slug: "freightwaves",
    name: "FreightWaves SONAR",
    shortName: "FreightWaves",
    tagline: "LaneBrief vs FreightWaves SONAR — Which is right for freight brokers?",
    pricing: "$2,500–$5,000/mo",
    targetAudience: "Enterprise shippers, analysts, large carriers",
    description:
      "FreightWaves SONAR is a powerful market-wide freight data platform used by enterprise shippers and analysts. It offers broad market indices and macroeconomic freight signals. LaneBrief is purpose-built for independent freight brokers who need lane-specific intelligence, not market-wide indices.",
    features: [
      { label: "Real-time spot rates", lanebrief: true, competitor: true },
      { label: "Lane-specific rate alerts", lanebrief: true, competitor: false },
      { label: "7-day rate forecast per lane", lanebrief: true, competitor: false },
      { label: "Carrier payment risk score", lanebrief: true, competitor: false },
      { label: "USMCA tariff exposure flags", lanebrief: true, competitor: false },
      { label: "Weekly personalized lane report", lanebrief: true, competitor: false },
      { label: "Broker profit calculator", lanebrief: true, competitor: false },
      { label: "Setup time", lanebrief: "< 5 minutes", competitor: "Days/weeks + training" },
      { label: "Pricing", lanebrief: "Free + $79/mo", competitor: "$2,500–$5,000/mo" },
      { label: "Made for solo brokers", lanebrief: true, competitor: false },
      { label: "No contract required", lanebrief: true, competitor: false },
    ],
    switchReasons: [
      "LaneBrief costs 97% less — $79/mo vs $2,500+/mo — with no enterprise contract required",
      "LaneBrief delivers lane-level forecasts and alerts for your specific routes, not market-wide indices you have to interpret yourself",
      "Get up and running in 5 minutes — no onboarding sessions, training calls, or implementation teams needed",
    ],
    metaDescription:
      "LaneBrief vs FreightWaves SONAR (2026) — honest comparison for freight brokers. See features, pricing, and who each tool is built for.",
  },
  "dat-market-conditions": {
    slug: "dat-market-conditions",
    name: "DAT Market Conditions",
    shortName: "DAT",
    tagline: "LaneBrief vs DAT Market Conditions — Which is right for freight brokers?",
    pricing: "$150+/mo (bundled with load board)",
    targetAudience: "Load board users, broad freight market research",
    description:
      "DAT Market Conditions is a market data tool bundled with the DAT load board. It provides broad market rate indices and lane history for shippers and carriers. LaneBrief focuses exclusively on the intelligence freight brokers need to make margin-protecting decisions: lane-specific forecasts, carrier risk scores, and tariff alerts.",
    features: [
      { label: "Real-time spot rates", lanebrief: true, competitor: true },
      { label: "Lane-specific rate alerts", lanebrief: true, competitor: false },
      { label: "7-day rate forecast per lane", lanebrief: true, competitor: false },
      { label: "Carrier payment risk score", lanebrief: true, competitor: false },
      { label: "USMCA tariff exposure flags", lanebrief: true, competitor: false },
      { label: "Weekly personalized lane report", lanebrief: true, competitor: false },
      { label: "Broker profit calculator", lanebrief: true, competitor: false },
      { label: "Setup time", lanebrief: "< 5 minutes", competitor: "Bundle signup required" },
      { label: "Pricing", lanebrief: "Free + $79/mo", competitor: "$150+/mo (requires load board)" },
      { label: "Standalone subscription", lanebrief: true, competitor: false },
      { label: "Made for solo brokers", lanebrief: true, competitor: false },
    ],
    switchReasons: [
      "LaneBrief is a standalone subscription — you don't need a load board bundle to access lane intelligence",
      "LaneBrief delivers forward-looking 7-day forecasts and carrier risk scores; DAT Market Conditions shows you historical index data",
      "LaneBrief is built around your specific lanes, not market-wide aggregates you have to manually interpret",
    ],
    metaDescription:
      "LaneBrief vs DAT Market Conditions (2026) — honest comparison for freight brokers. Features, pricing, and which tool fits independent brokers.",
  },
  truckstop: {
    slug: "truckstop",
    name: "Truckstop Analytics",
    shortName: "Truckstop",
    tagline: "LaneBrief vs Truckstop — Which is right for freight brokers?",
    pricing: "Bundled with load board ($150–$400/mo)",
    targetAudience: "Small to mid-size brokers on the Truckstop load board",
    description:
      "Truckstop offers rate analysis tools bundled with its load board platform. It is SMB-friendly and covers some rate analytics. LaneBrief goes beyond rate lookup with predictive lane forecasts, carrier payment risk scoring, tariff flags, and a weekly intelligence report — all in a standalone tool that doesn't require a load board subscription.",
    features: [
      { label: "Real-time spot rates", lanebrief: true, competitor: true },
      { label: "Lane-specific rate alerts", lanebrief: true, competitor: false },
      { label: "7-day rate forecast per lane", lanebrief: true, competitor: false },
      { label: "Carrier payment risk score", lanebrief: true, competitor: false },
      { label: "USMCA tariff exposure flags", lanebrief: true, competitor: false },
      { label: "Weekly personalized lane report", lanebrief: true, competitor: false },
      { label: "Broker profit calculator", lanebrief: true, competitor: false },
      { label: "Setup time", lanebrief: "< 5 minutes", competitor: "Load board signup + setup" },
      { label: "Pricing", lanebrief: "Free + $79/mo", competitor: "$150–$400/mo (load board bundle)" },
      { label: "Standalone subscription", lanebrief: true, competitor: false },
      { label: "No contract required", lanebrief: true, competitor: false },
    ],
    switchReasons: [
      "LaneBrief is a standalone tool — no load board subscription required, just sign up and add your lanes",
      "LaneBrief gives you forward-looking lane forecasts and carrier risk scores that Truckstop Analytics doesn't offer",
      "At $79/mo vs $150–$400/mo bundled, LaneBrief delivers more broker-specific intelligence at a lower cost",
    ],
    metaDescription:
      "LaneBrief vs Truckstop (2026) — honest comparison for freight brokers. Features, pricing, and which platform delivers better broker intelligence.",
  },
};

export async function generateStaticParams() {
  return Object.keys(COMPETITORS).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const c = COMPETITORS[slug];
  if (!c) return {};
  const year = new Date().getFullYear();
  return {
    title: `LaneBrief vs ${c.name} (${year}) — Honest Comparison for Freight Brokers`,
    description: c.metaDescription,
    alternates: { canonical: `https://lanebrief.com/vs/${c.slug}` },
    openGraph: {
      title: `LaneBrief vs ${c.name} — Freight Broker Comparison`,
      description: c.metaDescription,
      url: `https://lanebrief.com/vs/${c.slug}`,
    },
  };
}

function CheckIcon() {
  return (
    <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg className="w-5 h-5 text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function FeatureCell({ value }: { value: boolean | string }) {
  if (typeof value === "string") {
    return <span className="text-sm text-gray-700">{value}</span>;
  }
  return value ? <CheckIcon /> : <XIcon />;
}

export default async function CompetitorPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const c = COMPETITORS[slug];
  if (!c) notFound();

  const year = new Date().getFullYear();

  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <header className="border-b border-gray-100 bg-white sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="font-bold text-gray-900 text-lg">
            LaneBrief
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/vs"
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              All comparisons
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

      <main className="max-w-5xl mx-auto px-4 py-12">
        {/* Hero */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 text-xs font-medium px-3 py-1.5 rounded-full mb-6">
            Honest comparison — {year}
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4 leading-tight">
            LaneBrief vs {c.name}
            <br />
            <span className="text-gray-500 font-normal text-2xl md:text-3xl">
              Which is right for freight brokers?
            </span>
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-8">
            {c.description}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/sign-up"
              className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors text-center"
            >
              Try LaneBrief Free
            </Link>
            <a
              href="#comparison"
              className="px-6 py-3 border border-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors text-center"
            >
              See full comparison ↓
            </a>
          </div>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-16">
          <div className="bg-blue-50 rounded-xl p-5 text-center">
            <div className="text-2xl font-bold text-blue-700 mb-1">$79/mo</div>
            <div className="text-sm text-blue-600">LaneBrief Pro</div>
            <div className="text-xs text-gray-500 mt-1">Free plan available</div>
          </div>
          <div className="bg-gray-50 rounded-xl p-5 text-center">
            <div className="text-2xl font-bold text-gray-700 mb-1">{c.pricing}</div>
            <div className="text-sm text-gray-600">{c.shortName}</div>
            <div className="text-xs text-gray-500 mt-1">{c.targetAudience}</div>
          </div>
          <div className="bg-green-50 rounded-xl p-5 text-center">
            <div className="text-2xl font-bold text-green-700 mb-1">&lt; 5 min</div>
            <div className="text-sm text-green-600">Setup time</div>
            <div className="text-xs text-gray-500 mt-1">No demos, no contracts</div>
          </div>
        </div>

        {/* Feature comparison table */}
        <section id="comparison" className="mb-16">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Feature comparison</h2>
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left px-5 py-3 text-sm font-semibold text-gray-600 w-1/2">Feature</th>
                  <th className="text-center px-4 py-3 text-sm font-semibold text-blue-700 w-1/4">
                    LaneBrief
                  </th>
                  <th className="text-center px-4 py-3 text-sm font-semibold text-gray-500 w-1/4">
                    {c.shortName}
                  </th>
                </tr>
              </thead>
              <tbody>
                {c.features.map((f, i) => (
                  <tr
                    key={f.label}
                    className={i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}
                  >
                    <td className="px-5 py-3 text-sm text-gray-700">{f.label}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex justify-center">
                        <FeatureCell value={f.lanebrief} />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex justify-center">
                        <FeatureCell value={f.competitor} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Who it's for */}
        <section className="mb-16">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Who each tool is built for</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border-2 border-blue-200 rounded-xl p-6 bg-blue-50/30">
              <div className="font-bold text-blue-800 mb-2">LaneBrief is for:</div>
              <ul className="space-y-2 text-sm text-gray-700">
                <li className="flex gap-2 items-start"><CheckIcon /><span>Independent freight brokers and small teams (1–10 people)</span></li>
                <li className="flex gap-2 items-start"><CheckIcon /><span>Brokers who need lane-specific intelligence for the routes they actually run</span></li>
                <li className="flex gap-2 items-start"><CheckIcon /><span>Anyone who wants actionable intelligence — not raw market data to interpret yourself</span></li>
                <li className="flex gap-2 items-start"><CheckIcon /><span>Teams that need to be up and running in minutes, not weeks</span></li>
              </ul>
            </div>
            <div className="border border-gray-200 rounded-xl p-6 bg-gray-50/30">
              <div className="font-bold text-gray-700 mb-2">{c.shortName} is for:</div>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex gap-2 items-start">
                  <svg className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                  <span>{c.targetAudience}</span>
                </li>
                <li className="flex gap-2 items-start">
                  <svg className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                  <span>Teams with dedicated analysts and budget for enterprise tooling</span>
                </li>
                <li className="flex gap-2 items-start">
                  <svg className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                  <span>Organizations that need broad market-wide freight indices</span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Why brokers switch */}
        <section className="mb-16">
          <h2 className="text-xl font-bold text-gray-900 mb-6">
            Why freight brokers choose LaneBrief over {c.shortName}
          </h2>
          <div className="space-y-4">
            {c.switchReasons.map((reason, i) => (
              <div key={i} className="flex gap-4 items-start bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm flex-shrink-0">
                  {i + 1}
                </div>
                <p className="text-gray-700 text-sm leading-relaxed">{reason}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-8 md:p-12 text-center text-white mb-12">
          <h2 className="text-2xl md:text-3xl font-bold mb-3">
            Try LaneBrief free for 14 days
          </h2>
          <p className="text-blue-100 mb-6 max-w-xl mx-auto">
            No card required. See your lanes in 5 minutes. Built for freight brokers who need intelligence, not data.
          </p>
          <Link
            href="/sign-up"
            className="inline-block px-8 py-3 bg-white text-blue-700 font-bold rounded-lg hover:bg-blue-50 transition-colors text-sm"
          >
            Start Free Trial
          </Link>
        </section>

        {/* Related comparisons */}
        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-4">Other comparisons</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {Object.values(COMPETITORS)
              .filter((comp) => comp.slug !== slug)
              .map((comp) => (
                <Link
                  key={comp.slug}
                  href={`/vs/${comp.slug}`}
                  className="border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-700 hover:border-blue-300 hover:bg-blue-50/30 transition-colors"
                >
                  LaneBrief vs {comp.shortName} →
                </Link>
              ))}
            <Link
              href="/vs"
              className="border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-500 hover:border-gray-300 hover:bg-gray-50 transition-colors"
            >
              All comparisons →
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-gray-100 py-6 mt-8">
        <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-400">
          <span>© {year} LaneBrief. All rights reserved.</span>
          <div className="flex gap-4">
            <Link href="/pricing" className="hover:text-gray-600">Pricing</Link>
            <Link href="/privacy" className="hover:text-gray-600">Privacy</Link>
            <Link href="/" className="hover:text-gray-600">Home</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
