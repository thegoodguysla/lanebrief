import Link from "next/link";
import { buildIntelligenceReportHtml } from "@/app/api/cron/weekly-intelligence-report/route";
import type { LaneBrief } from "@/app/api/cron/weekly-intelligence-report/route";

// Static sample data for public preview — no auth required
const SAMPLE_LANES: LaneBrief[] = [
  {
    origin: "Chicago, IL",
    destination: "Dallas, TX",
    equipment: "dry_van",
    rateSummary: "$2.34/mi",
    rateUsdPerMile: 2.34,
    deltaPct: 3.2,
    capacitySignal: "moderate",
    tenderRisk: "medium",
    tenderAcceptancePct: 68,
    tariffFlag: null,
    carrierRecommendation: "Mid-size carriers outperform nationals on I-55 corridor",
    aiSummary: "Post-holiday restocking surge pushing dry van rates above seasonal baseline this week.",
  },
  {
    origin: "Los Angeles, CA",
    destination: "Phoenix, AZ",
    equipment: "reefer",
    rateSummary: "$3.12/mi",
    rateUsdPerMile: 3.12,
    deltaPct: -1.8,
    capacitySignal: "loose",
    tenderRisk: "low",
    tenderAcceptancePct: 84,
    tariffFlag: null,
    carrierRecommendation: "Established West Coast reefer networks offer best rates and reliability",
    aiSummary: "Produce season easing slightly; LA port volumes stabilizing after recent congestion.",
  },
  {
    origin: "Detroit, MI",
    destination: "Toronto, ON",
    equipment: "flatbed",
    rateSummary: "$4.18/mi",
    rateUsdPerMile: 4.18,
    deltaPct: 8.5,
    capacitySignal: "tight",
    tenderRisk: "high",
    tenderAcceptancePct: 41,
    tariffFlag: "CA-high",
    carrierRecommendation: "Use dual-licensed Canadian carriers to avoid customs delays",
    aiSummary: "35% Canada tariff exposure — auto parts volumes spiking ahead of quota deadline.",
  },
];

export const metadata = {
  title: "Weekly LaneBrief Intelligence Report | LaneBrief",
  description:
    "Your personalized weekly freight market brief — rate trends, carrier recommendations, and capacity signals for your top lanes. Free for freight brokers.",
};

export default function WeeklyReportPage() {
  const html = buildIntelligenceReportHtml(SAMPLE_LANES, true);
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
        {/* Header */}
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            Sample report — Week of {weekOf}
          </div>
          <h1 className="text-3xl font-bold tracking-tight">
            Your Weekly Freight Intelligence Brief
          </h1>
          <p className="text-muted-foreground text-lg leading-relaxed">
            Every Monday morning, LaneBrief delivers a personalized market brief covering rate trends,
            capacity signals, and carrier recommendations for your top lanes. No more spreadsheets or
            checking 5 sources before your first coffee.
          </p>
        </div>

        {/* What's included */}
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { icon: "📈", label: "Rate trends", desc: "Week-over-week % change per lane" },
            { icon: "🚛", label: "Carrier recs", desc: "Top carrier type for each lane" },
            { icon: "📦", label: "Capacity signals", desc: "Tight / moderate / loose index" },
            { icon: "⚠", label: "Tariff alerts", desc: "US-MX & US-CA tariff exposure flags" },
          ].map((item) => (
            <div key={item.label} className="flex items-start gap-3 rounded-lg border border-border p-3">
              <span className="text-xl shrink-0">{item.icon}</span>
              <div>
                <p className="text-sm font-medium">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-6 text-center space-y-3">
          <p className="font-semibold">Get your personalized report every Monday — free</p>
          <p className="text-sm text-muted-foreground">
            Add your top lanes and we'll generate a tailored brief for your specific freight market.
          </p>
          <Link
            href="/sign-up"
            className="inline-block rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Start free — no credit card
          </Link>
        </div>

        {/* Sample report */}
        <div className="space-y-3">
          <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Sample report (3 lanes)
          </h2>
          <div
            className="rounded-lg border border-border overflow-hidden"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>

        {/* Footer note */}
        <p className="text-xs text-muted-foreground text-center">
          Rates are AI-estimated for illustration. Sign up to get live weekly reports for your actual lanes.
        </p>
      </main>
    </div>
  );
}
