import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "LaneBrief vs Alternatives — Competitor Comparisons for Freight Brokers",
  description:
    "See how LaneBrief compares to FreightWaves, DAT, and Truckstop. Honest feature and pricing comparisons for independent freight brokers.",
  alternates: { canonical: "https://lanebrief.com/vs" },
};

const COMPARISONS = [
  {
    slug: "freightwaves",
    name: "FreightWaves SONAR",
    shortName: "FreightWaves",
    theirPricing: "$2,500–$5,000/mo",
    ourPricing: "$79/mo",
    blurb: "Enterprise market-wide indices vs lane-specific broker intelligence.",
  },
  {
    slug: "dat-market-conditions",
    name: "DAT Market Conditions",
    shortName: "DAT",
    theirPricing: "$150+/mo (bundled)",
    ourPricing: "$79/mo",
    blurb: "Bundled load board data vs standalone lane forecasts and risk scores.",
  },
  {
    slug: "truckstop",
    name: "Truckstop Analytics",
    shortName: "Truckstop",
    theirPricing: "$150–$400/mo (bundled)",
    ourPricing: "$79/mo",
    blurb: "Load board analytics bundle vs purpose-built broker intelligence.",
  },
];

export default function VsIndexPage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-100 bg-white">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="font-bold text-gray-900 text-lg">
            LaneBrief
          </Link>
          <Link
            href="/sign-up"
            className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            Try free
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-16">
        <div className="text-center mb-14">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            LaneBrief vs Alternatives
          </h1>
          <p className="text-lg text-gray-600 max-w-xl mx-auto">
            Honest comparisons of features and pricing — built for independent freight brokers evaluating their options.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-16">
          {COMPARISONS.map((c) => (
            <Link
              key={c.slug}
              href={`/vs/${c.slug}`}
              className="group border border-gray-200 rounded-xl p-6 hover:border-blue-300 hover:shadow-md transition-all"
            >
              <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
                LaneBrief vs
              </div>
              <h2 className="text-lg font-bold text-gray-900 mb-2 group-hover:text-blue-700 transition-colors">
                {c.shortName}
              </h2>
              <p className="text-sm text-gray-500 mb-4">{c.blurb}</p>
              <div className="flex items-center justify-between text-xs">
                <div>
                  <span className="text-green-600 font-semibold">{c.ourPricing}</span>
                  <span className="text-gray-400 mx-1">vs</span>
                  <span className="text-gray-500">{c.theirPricing}</span>
                </div>
              </div>
              <div className="mt-4 text-xs text-blue-600 font-medium group-hover:underline">
                See comparison →
              </div>
            </Link>
          ))}
        </div>

        <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-8 text-center text-white">
          <h2 className="text-2xl font-bold mb-3">Ready to switch?</h2>
          <p className="text-blue-100 mb-6 max-w-md mx-auto text-sm">
            Try LaneBrief free — no card required. See your lanes in under 5 minutes.
          </p>
          <Link
            href="/sign-up"
            className="inline-block px-6 py-3 bg-white text-blue-700 font-bold rounded-lg hover:bg-blue-50 transition-colors text-sm"
          >
            Start Free Trial
          </Link>
        </div>
      </main>

      <footer className="border-t border-gray-100 py-6 mt-8">
        <div className="max-w-4xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-400">
          <span>© {new Date().getFullYear()} LaneBrief. All rights reserved.</span>
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
