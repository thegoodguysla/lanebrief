"use client";

import { useState } from "react";
import { sendGAEvent } from "@next/third-parties/google";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const SAMPLE_RATES = [
  { label: "Spot (dry van)", perMile: "$2.82", allIn: "$4,047", trend: "+6.4% vs 30 days ago" },
  { label: "Contract (dry van)", perMile: "$2.95", allIn: "$4,233", trend: "+2.8% vs 30 days ago" },
  { label: "National avg spot", perMile: "$2.65", allIn: "—", trend: "+$0.24 vs Feb avg" },
];

const FORECAST_ROWS = [
  { window: "Next 2 weeks", forecast: "$2.75–$2.90/mi", confidence: "High" },
  { window: "30-day", forecast: "$2.60–$2.80/mi", confidence: "Medium" },
  { window: "60-day", forecast: "$2.50–$2.70/mi", confidence: "Medium" },
];

export default function LaneBriefLanding() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Rate Benchmarker state
  const [bmOrigin, setBmOrigin] = useState("");
  const [bmDestination, setBmDestination] = useState("");
  const [bmRate, setBmRate] = useState("");
  const [bmEquipment, setBmEquipment] = useState("dry van");
  const [bmLoading, setBmLoading] = useState(false);
  const [bmResult, setBmResult] = useState<{
    market_avg_usd_per_mile: number;
    delta_pct: number;
    verdict: "above_market" | "at_market" | "below_market";
    verdict_label: string;
    disclaimer: string;
  } | null>(null);
  const [bmError, setBmError] = useState<string | null>(null);

  const handleBenchmark = async (e: React.FormEvent) => {
    e.preventDefault();
    const rate = parseFloat(bmRate);
    if (!bmOrigin || !bmDestination || isNaN(rate)) return;
    setBmLoading(true);
    setBmResult(null);
    setBmError(null);
    try {
      const res = await fetch("/api/benchmark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin: bmOrigin,
          destination: bmDestination,
          rate_per_mile: rate,
          equipment: bmEquipment,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setBmError(err.error || "Something went wrong. Try again.");
      } else {
        const data = await res.json();
        setBmResult(data);
        sendGAEvent("event", "form_submit", { form_name: "rate_benchmarker" });
      }
    } catch {
      setBmError("Network error. Please try again.");
    } finally {
      setBmLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email) return;
    setSubmitting(true);
    try {
      await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, type: "signup" }),
      });
      sendGAEvent("event", "form_submit", { form_name: "waitlist" });
    } finally {
      setSubmitting(false);
      setSubmitted(true);
    }
  };

  return (
    <div className="flex flex-col min-h-full bg-background text-foreground">

      {/* ── Nav ──────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-md" role="banner">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <a href="/" aria-label="LaneBrief — home" className="flex items-center gap-2">
            <span className="text-primary font-bold text-xl tracking-tight" aria-hidden="true">▸</span>
            <span className="font-bold text-xl tracking-tight text-foreground">LaneBrief</span>
            <Badge variant="outline" className="text-xs border-primary/40 text-primary hidden sm:inline-flex">
              Beta
            </Badge>
          </a>
          <nav aria-label="Main navigation" className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#how-it-works" className="hover:text-foreground transition-colors">How it works</a>
            <a href="#sample" className="hover:text-foreground transition-colors">Sample report</a>
            <a href="#benchmarker" className="hover:text-foreground transition-colors">Rate check</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
          </nav>
          <a href="#get-started" className={cn(buttonVariants({ size: "sm" }), "bg-primary text-primary-foreground hover:bg-primary/90")}>
            Get free lane brief
          </a>
        </div>
      </header>

      <main id="main-content">

        {/* ── SB7 §1: CHARACTER + PROBLEM (Hero) ───────────────────────── */}
        {/* Lead with the customer's problem, not our features */}
        <section
          aria-labelledby="hero-heading"
          className="relative flex flex-col items-center text-center px-4 pt-24 pb-20 sm:pt-32 sm:pb-28 overflow-hidden"
        >
          <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full bg-primary/10 blur-[120px]" />
          </div>

          <Badge className="mb-6 bg-primary/15 text-primary border border-primary/30 hover:bg-primary/20">
            Founding pilot — limited to 10 brokers
          </Badge>

          <h1 id="hero-heading" className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight max-w-3xl leading-tight">
            You&apos;re making rate decisions{" "}
            <span className="text-primary">without real lane intelligence.</span>
          </h1>

          <p className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-2xl leading-relaxed">
            Every week you fly blind on lane conditions is margin left on the table.
            Your competitors aren&apos;t guessing. You shouldn&apos;t have to either.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
            <a href="#get-started" className={cn(buttonVariants({ size: "lg" }), "bg-primary text-primary-foreground hover:bg-primary/90 text-base px-8")}>
              Get Your Free Lane Brief
            </a>
            <a href="#sample" className={cn(buttonVariants({ size: "lg", variant: "outline" }), "text-base border-border/60 hover:bg-muted/50")}>
              See a sample report →
            </a>
          </div>

          <p className="mt-4 text-sm text-muted-foreground">
            No credit card. No commitment. Just data.
          </p>

          {/* Stat strip */}
          <div className="mt-16 grid grid-cols-3 gap-6 sm:gap-12 max-w-xl w-full" role="list" aria-label="Key statistics">
            {[
              { label: "Analyst-grade briefs", value: "$199/mo" },
              { label: "vs. DAT iQ pricing", value: "1/3 cost" },
              { label: "Forward rate window", value: "30 days" },
            ].map((s) => (
              <div key={s.label} role="listitem" className="flex flex-col items-center gap-1">
                <span className="font-mono text-2xl font-bold text-primary">{s.value}</span>
                <span className="text-xs text-muted-foreground text-center">{s.label}</span>
              </div>
            ))}
          </div>
        </section>

        <Separator className="opacity-20" />

        {/* ── SB7 §2: FAILURE STAKES ────────────────────────────────────── */}
        {/* What happens without LaneBrief */}
        <section
          aria-labelledby="stakes-heading"
          className="py-20 px-4 bg-card/20"
        >
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <h2 id="stakes-heading" className="text-3xl sm:text-4xl font-bold">
                What flying blind costs you every month.
              </h2>
              <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
                Manual market research is slow, incomplete, and expensive. Here&apos;s where independent brokers leak margin.
              </p>
            </div>
            <div className="grid sm:grid-cols-3 gap-6">
              {[
                {
                  icon: "📉",
                  title: "Missed rate windows",
                  desc: "Spot rates spike and compress in 3–5 day windows. Without forward signals, you price yesterday's market — not tomorrow's.",
                },
                {
                  icon: "⏳",
                  title: "Hours lost on research",
                  desc: "Checking DAT, load boards, news, carrier forums — every week, manually. That time compounds into real cost.",
                },
                {
                  icon: "📊",
                  title: "Competitor intelligence gap",
                  desc: "Large 3PLs have in-house analysts and enterprise data tools. You're competing against people with better information.",
                },
              ].map((item) => (
                <Card key={item.title} className="bg-card border-border/50 border-l-2 border-l-destructive/60">
                  <CardHeader className="pb-3">
                    <div className="text-3xl mb-2" aria-hidden="true">{item.icon}</div>
                    <CardTitle className="text-lg">{item.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground text-sm leading-relaxed">{item.desc}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <Separator className="opacity-20" />

        {/* ── SB7 §3: GUIDE (Empathy + Authority) ──────────────────────── */}
        <section
          aria-labelledby="guide-heading"
          className="py-20 px-4"
        >
          <div className="max-w-4xl mx-auto">
            <div className="grid sm:grid-cols-2 gap-12 items-center">
              <div>
                <Badge className="mb-4 bg-primary/15 text-primary border border-primary/30">Why we built this</Badge>
                <h2 id="guide-heading" className="text-3xl font-bold mb-4">
                  We closed the intelligence gap so you don&apos;t have to.
                </h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  Independent freight brokers compete every day against enterprises with in-house data teams and
                  $60K/year analysts. We know the intelligence gap is real — and we know it shows up in margin.
                </p>
                <p className="text-muted-foreground leading-relaxed mb-6">
                  LaneBrief synthesizes the same underlying data sources — DAT aggregates, load board feeds,
                  FMCSA carrier data — into a clean monthly brief built around your specific lanes.
                  For the price of one mediocre load.
                </p>
                <blockquote className="border-l-2 border-primary/40 pl-4">
                  <p className="text-sm italic text-muted-foreground">
                    &ldquo;One better-priced load covers the subscription. We&apos;re not an expense —
                    we&apos;re a tool that should pay for itself in the first deal.&rdquo;
                  </p>
                </blockquote>
              </div>
              <div className="grid grid-cols-2 gap-4" role="list" aria-label="What makes LaneBrief credible">
                {[
                  { icon: "🔍", title: "Built on real data", desc: "DAT aggregates, load board feeds, FMCSA carrier data" },
                  { icon: "🤖", title: "AI synthesis", desc: "Synthesized from the same sources analysts use — not fabricated" },
                  { icon: "📬", title: "Delivered monthly", desc: "Brief in your inbox 5 days before the period starts" },
                  { icon: "🔒", title: "No lock-in", desc: "Cancel anytime. No annual contracts. No risk." },
                ].map((item) => (
                  <Card key={item.title} role="listitem" className="bg-card border-border/40">
                    <CardContent className="p-4">
                      <div className="text-2xl mb-2" aria-hidden="true">{item.icon}</div>
                      <h3 className="font-semibold text-sm mb-1">{item.title}</h3>
                      <p className="text-xs text-muted-foreground">{item.desc}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </section>

        <Separator className="opacity-20" />

        {/* ── SB7 §4: PLAN (3 simple steps) ────────────────────────────── */}
        <section
          id="how-it-works"
          aria-labelledby="plan-heading"
          className="py-20 px-4 bg-card/20"
        >
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <h2 id="plan-heading" className="text-3xl sm:text-4xl font-bold">
                Up and running in 3 steps.
              </h2>
              <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
                No setup fees. No data integrations. No learning curve.
              </p>
            </div>

            <ol className="grid sm:grid-cols-3 gap-6" aria-label="How LaneBrief works">
              {[
                {
                  step: "1",
                  title: "Sign up free",
                  desc: "Enter your email and request your first free lane brief. No credit card required.",
                  sub: "Takes 60 seconds",
                },
                {
                  step: "2",
                  title: "Tell us your lanes",
                  desc: "Share your top 3 freight corridors. That's all we need to build your first intelligence brief.",
                  sub: "Your top 3 lanes, origin → destination",
                },
                {
                  step: "3",
                  title: "Get weekly intelligence",
                  desc: "Receive monthly AI-synthesized freight market data, rate forecasts, and capacity signals — built for your lanes.",
                  sub: "Delivered 5 days before each period",
                },
              ].map((item) => (
                <li key={item.step}>
                  <Card className="bg-card border-border/50 hover:border-primary/30 transition-colors h-full">
                    <CardHeader className="pb-3">
                      <div className="w-10 h-10 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center mb-3">
                        <span className="text-primary font-bold text-lg" aria-hidden="true">{item.step}</span>
                      </div>
                      <CardTitle className="text-lg">{item.title}</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-3">
                      <p className="text-muted-foreground text-sm leading-relaxed">{item.desc}</p>
                      <p className="text-xs text-primary/80 font-mono border-l-2 border-primary/30 pl-3">{item.sub}</p>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <Separator className="opacity-20" />

        {/* ── SB7 §5: SUCCESS (What life looks like with LaneBrief) ─────── */}
        <section
          aria-labelledby="success-heading"
          className="py-20 px-4"
        >
          <div className="max-w-5xl mx-auto text-center">
            <h2 id="success-heading" className="text-3xl sm:text-4xl font-bold mb-4">
              Confident lane decisions. Higher margins. Market edge.
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto mb-12">
              LaneBrief customers stop reacting to the market and start anticipating it.
            </p>
            <div className="grid sm:grid-cols-3 gap-6" role="list" aria-label="Benefits of LaneBrief">
              {[
                {
                  icon: "📍",
                  title: "Lane-Specific Forecasts",
                  desc: "We don't give you national averages. Every brief is built around your top corridors — so you know if Chicago → Dallas is tightening before it hits the spot market.",
                  sub: "Built on DAT aggregates + proprietary capacity signals",
                },
                {
                  icon: "⏱",
                  title: "Act Before the Market Moves",
                  desc: "Most brokers react to rate changes. Our subscribers see the leading indicators — carrier availability shifts, seasonal buildups, regional events — weeks in advance.",
                  sub: "Average brief covers a 30-day forward window with historical comp",
                },
                {
                  icon: "💡",
                  title: "Analyst Synthesis, Not Raw Data",
                  desc: "DAT Basic shows you what rates ARE. We show you what they're about to DO — and why. That's the gap between reacting and planning.",
                  sub: "Written recommendations included with every brief",
                },
              ].map((item) => (
                <Card key={item.title} role="listitem" className="bg-card border-border/50 hover:border-primary/30 transition-colors border-l-2 border-l-primary/60">
                  <CardHeader className="pb-3">
                    <div className="text-3xl mb-2" aria-hidden="true">{item.icon}</div>
                    <CardTitle className="text-lg">{item.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3">
                    <p className="text-muted-foreground text-sm leading-relaxed">{item.desc}</p>
                    <p className="text-xs text-primary/80 font-mono border-l-2 border-primary/30 pl-3">{item.sub}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <Separator className="opacity-20" />

        {/* ── SB7 §6: AUTHORITY — Sample Report Preview ────────────────── */}
        <section id="sample" aria-labelledby="sample-heading" className="py-20 px-4 bg-card/30">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <Badge className="mb-4 bg-primary/15 text-primary border border-primary/30">
                Sample Brief — LA → DFW
              </Badge>
              <h2 id="sample-heading" className="text-3xl sm:text-4xl font-bold">
                This is what your team receives every month.
              </h2>
              <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
                Actual brief excerpt for the Los Angeles → Dallas-Fort Worth dry van lane.
                Every brief is this specific to your routes.
              </p>
            </div>

            {/* Brief excerpt card */}
            <article
              aria-label="Sample freight intelligence brief for LA to DFW lane"
              className="bg-card border border-border/60 rounded-xl font-mono text-sm max-w-4xl mx-auto overflow-hidden"
            >
              {/* Brief header */}
              <header className="bg-primary/10 border-b border-primary/20 px-6 py-4">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <p className="text-primary font-bold text-base">FREIGHT INTELLIGENCE BRIEF</p>
                    <p className="text-muted-foreground text-xs mt-1">
                      Los Angeles, CA → Dallas-Fort Worth, TX | Dry Van | 1,435 mi
                    </p>
                  </div>
                  <Badge className="bg-primary/20 text-primary border-primary/40 text-xs shrink-0">
                    Week of March 31, 2026
                  </Badge>
                </div>
              </header>

              <div className="p-6 space-y-6">
                {/* Rate Intelligence */}
                <section aria-labelledby="rate-intel-heading">
                  <h3 id="rate-intel-heading" className="text-foreground font-bold text-xs uppercase tracking-widest mb-3 text-primary">
                    Rate Intelligence
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs" aria-label="LA to DFW rate data">
                      <thead>
                        <tr className="border-b border-border/40">
                          <th scope="col" className="text-left text-muted-foreground pb-2 font-normal">Rate Type</th>
                          <th scope="col" className="text-right text-muted-foreground pb-2 font-normal">Per Mile</th>
                          <th scope="col" className="text-right text-muted-foreground pb-2 font-normal">All-In</th>
                          <th scope="col" className="text-right text-muted-foreground pb-2 font-normal hidden sm:table-cell">30-Day Trend</th>
                        </tr>
                      </thead>
                      <tbody>
                        {SAMPLE_RATES.map((row) => (
                          <tr key={row.label} className="border-b border-border/20">
                            <td className="py-2 text-foreground">{row.label}</td>
                            <td className="py-2 text-right text-primary font-bold">{row.perMile}</td>
                            <td className="py-2 text-right text-foreground">{row.allIn}</td>
                            <td className="py-2 text-right hidden sm:table-cell">
                              <span className="text-green-400">{row.trend}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                {/* 30-Day Forecast */}
                <section aria-labelledby="forecast-heading">
                  <h3 id="forecast-heading" className="text-foreground font-bold text-xs uppercase tracking-widest mb-3 text-primary">
                    30/60-Day Spot Forecast
                  </h3>
                  <div className="space-y-2">
                    {FORECAST_ROWS.map((row) => (
                      <div key={row.window} className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground w-28">{row.window}</span>
                        <span className="text-foreground font-semibold flex-1">{row.forecast}</span>
                        <Badge variant="outline" className="text-xs border-border/40 text-muted-foreground">
                          {row.confidence}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Key Takeaway */}
                <aside aria-label="Key takeaway" className="bg-primary/8 border border-primary/20 rounded-lg p-4">
                  <p className="text-xs font-bold text-primary uppercase tracking-widest mb-2">Key Takeaway</p>
                  <p className="text-foreground text-sm leading-relaxed">
                    This lane is structurally tighter than seasonal patterns suggest. The combination of fuel
                    shock, carrier attrition, and narrowing spot-contract spread means Q2 2026 will not see
                    the typical spring rate trough.{" "}
                    <strong className="text-primary">
                      Lock favorable contract rates now — Q3 is expected to be even tighter.
                    </strong>
                  </p>
                </aside>

                {/* Blurred remaining content teaser */}
                <div className="relative" aria-hidden="true">
                  <div className="select-none blur-sm opacity-50 pointer-events-none space-y-2 text-xs text-muted-foreground">
                    <p>■■■■■■■■■■■■■■■■■■■■■■■■■■■■ Carrier Landscape ■■■■■■■■■■■■■■■</p>
                    <p>Active carriers on LA→DFW: ~3,800–4,200 | YoY change: ▼ -8% to -12%</p>
                    <p>■■■■■■■■■■■■■■■■■■■■■■ Actionable Recommendations ■■■■■■■■■■■■■</p>
                    <p>1. Target spot booking rate: $2.75–$2.85/mi for loads in next 7–14 days</p>
                    <p>2. Carrier negotiation leverage: DFW reload advantage worth $0.05–$0.10/mi</p>
                    <p>3. Fuel surcharge audit: verify FSC reflects $5.40+/gal diesel baseline</p>
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-t from-card via-card/80 to-transparent rounded">
                    <a href="#get-started" className={cn(buttonVariants({ size: "sm" }), "bg-primary text-primary-foreground hover:bg-primary/90")}>
                      Get the full brief free →
                    </a>
                  </div>
                </div>
              </div>
            </article>
          </div>
        </section>

        <Separator className="opacity-20" />

        {/* ── Rate Benchmarker ─────────────────────────────────────────── */}
        <section id="benchmarker" aria-labelledby="benchmarker-heading" className="py-20 px-4 bg-card/20">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-10">
              <Badge className="mb-4 bg-primary/15 text-primary border border-primary/30">
                Free tool — no sign-up required
              </Badge>
              <h2 id="benchmarker-heading" className="text-3xl sm:text-4xl font-bold">
                Is your rate competitive?
              </h2>
              <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
                Enter your lane and rate. Our AI benchmarks it against current market conditions in seconds.
              </p>
            </div>

            <Card className="bg-card border-border/50">
              <CardContent className="p-6 sm:p-8">
                <form onSubmit={handleBenchmark} className="space-y-4" aria-label="Rate benchmarker">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label htmlFor="bm-origin" className="text-sm font-medium text-foreground">Origin</label>
                      <Input
                        id="bm-origin"
                        type="text"
                        placeholder="e.g. Chicago, IL"
                        value={bmOrigin}
                        onChange={(e) => setBmOrigin(e.target.value)}
                        required
                        className="bg-muted/50 border-border/60"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="bm-dest" className="text-sm font-medium text-foreground">Destination</label>
                      <Input
                        id="bm-dest"
                        type="text"
                        placeholder="e.g. Dallas, TX"
                        value={bmDestination}
                        onChange={(e) => setBmDestination(e.target.value)}
                        required
                        className="bg-muted/50 border-border/60"
                      />
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label htmlFor="bm-rate" className="text-sm font-medium text-foreground">Your rate ($/mile)</label>
                      <Input
                        id="bm-rate"
                        type="number"
                        step="0.01"
                        min="0.50"
                        max="15"
                        placeholder="e.g. 2.45"
                        value={bmRate}
                        onChange={(e) => setBmRate(e.target.value)}
                        required
                        className="bg-muted/50 border-border/60"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="bm-equipment" className="text-sm font-medium text-foreground">Equipment</label>
                      <select
                        id="bm-equipment"
                        value={bmEquipment}
                        onChange={(e) => setBmEquipment(e.target.value)}
                        className="flex h-10 w-full rounded-md border border-border/60 bg-muted/50 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                      >
                        <option value="dry van">Dry Van</option>
                        <option value="flatbed">Flatbed</option>
                        <option value="refrigerated">Refrigerated (Reefer)</option>
                        <option value="step deck">Step Deck</option>
                      </select>
                    </div>
                  </div>
                  <Button
                    type="submit"
                    disabled={bmLoading}
                    className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-11"
                  >
                    {bmLoading ? "Checking market…" : "Benchmark My Rate"}
                  </Button>
                </form>

                {bmError && (
                  <div role="alert" className="mt-6 p-4 rounded-lg border border-destructive/40 bg-destructive/10 text-sm text-destructive">
                    {bmError}
                  </div>
                )}

                {bmResult && (
                  <div role="region" aria-label="Benchmark result" className="mt-6 space-y-4">
                    <div className={cn(
                      "p-5 rounded-lg border",
                      bmResult.verdict === "above_market" && "border-green-500/40 bg-green-500/10",
                      bmResult.verdict === "at_market" && "border-primary/40 bg-primary/10",
                      bmResult.verdict === "below_market" && "border-yellow-500/40 bg-yellow-500/10",
                    )}>
                      <div className="flex items-start justify-between gap-4 flex-wrap mb-3">
                        <div>
                          <p className={cn(
                            "font-bold text-lg",
                            bmResult.verdict === "above_market" && "text-green-400",
                            bmResult.verdict === "at_market" && "text-primary",
                            bmResult.verdict === "below_market" && "text-yellow-400",
                          )}>
                            {bmResult.verdict_label}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1 font-mono">
                            {bmResult.delta_pct > 0 ? "+" : ""}{bmResult.delta_pct.toFixed(1)}% vs market avg
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs text-muted-foreground">Market avg</p>
                          <p className="font-mono font-bold text-xl text-foreground">
                            ${bmResult.market_avg_usd_per_mile.toFixed(2)}<span className="text-sm font-normal text-muted-foreground">/mi</span>
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <div className="flex-1 bg-background/40 rounded-full h-2 overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all",
                              bmResult.verdict === "above_market" && "bg-green-500",
                              bmResult.verdict === "at_market" && "bg-primary",
                              bmResult.verdict === "below_market" && "bg-yellow-500",
                            )}
                            style={{ width: `${Math.min(100, Math.max(5, 50 + bmResult.delta_pct * 5))}%` }}
                            aria-hidden="true"
                          />
                        </div>
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground text-center">{bmResult.disclaimer}</p>

                    <div className="text-center pt-2">
                      <p className="text-sm text-muted-foreground mb-3">Want the full lane intelligence brief — rate trends, capacity signals, 30-day forecast?</p>
                      <a href="#get-started" className={cn(buttonVariants({ size: "sm" }), "bg-primary text-primary-foreground hover:bg-primary/90")}>
                        Get your free lane brief →
                      </a>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </section>

        <Separator className="opacity-20" />

        {/* ── Pricing ──────────────────────────────────────────────────── */}
        <section id="pricing" aria-labelledby="pricing-heading" className="py-20 px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 id="pricing-heading" className="text-3xl sm:text-4xl font-bold">Simple, transparent pricing.</h2>
              <p className="mt-4 text-muted-foreground max-w-lg mx-auto">
                One plan. No annual lock-in. Cancel any time.
                If it doesn&apos;t improve how you price or plan, it&apos;s not worth your money.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-6 items-center max-w-3xl mx-auto">
              {/* LaneBrief plan */}
              <Card className="bg-primary/10 border-primary/40 relative overflow-hidden">
                <div className="absolute top-0 right-0 m-3">
                  <Badge className="bg-primary text-primary-foreground text-xs">Recommended</Badge>
                </div>
                <CardHeader>
                  <CardTitle className="text-2xl">LaneBrief</CardTitle>
                  <div className="flex items-end gap-2 mt-2">
                    <span className="text-5xl font-bold text-primary">$199</span>
                    <span className="text-muted-foreground mb-1">/month</span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-3 text-sm" aria-label="What's included">
                    {[
                      "Monthly intelligence brief (your top 3 lanes)",
                      "30-day rate forecast with confidence ranges",
                      "Capacity tightness indicators",
                      "Actionable pricing recommendations",
                      "Capacity alert emails (weekly)",
                      "Direct analyst access via email",
                      "Cancel anytime — no annual commitment",
                    ].map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <span className="text-primary mt-0.5 shrink-0" aria-hidden="true">✓</span>
                        <span className="text-muted-foreground">{item}</span>
                      </li>
                    ))}
                  </ul>
                  <a href="#get-started" className={cn(buttonVariants(), "w-full bg-primary text-primary-foreground hover:bg-primary/90 mt-4 justify-center")}>
                    Start Free with a Sample Brief
                  </a>
                  <p className="text-xs text-center text-muted-foreground">No credit card required to start</p>
                </CardContent>
              </Card>

              {/* Competitor comparison */}
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground font-medium uppercase tracking-widest mb-6">Compare</p>
                {[
                  {
                    name: "DAT Basic",
                    price: "$54/mo",
                    desc: "Raw spot rates. No forecasts. No synthesis. You do the analysis.",
                    bad: true,
                  },
                  {
                    name: "DAT iQ / Enterprise",
                    price: "$300–$3,600+/yr",
                    desc: "Full analytics suite. Built for large 3PLs with dedicated data teams.",
                    bad: true,
                  },
                  {
                    name: "LaneBrief",
                    price: "$199/mo",
                    desc: "Analyst-grade synthesis, lane-specific forecasts, actionable recs. Built for you.",
                    bad: false,
                  },
                ].map((item) => (
                  <Card
                    key={item.name}
                    className={`border-border/40 ${item.bad ? "opacity-60" : "border-primary/40 bg-primary/5"}`}
                  >
                    <CardContent className="p-4 flex items-start gap-3">
                      <span className={`text-lg mt-0.5 ${item.bad ? "text-muted-foreground" : "text-primary"}`} aria-hidden="true">
                        {item.bad ? "✗" : "✓"}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm">{item.name}</span>
                          <span className="text-xs text-muted-foreground font-mono">{item.price}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{item.desc}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </section>

        <Separator className="opacity-20" />

        {/* ── FAQ ───────────────────────────────────────────────────────── */}
        <section aria-labelledby="faq-heading" className="py-20 px-4 bg-card/20">
          <div className="max-w-3xl mx-auto">
            <h2 id="faq-heading" className="text-3xl font-bold text-center mb-12">Common questions.</h2>
            <dl className="space-y-6">
              {[
                {
                  q: "Why should I trust AI-generated intel?",
                  a: "Our briefs are built on the same underlying data sources — DAT, Truckstop, load board aggregates. We use AI to synthesize and forecast, not fabricate. Think of it as a data analyst working your numbers 24/7.",
                },
                {
                  q: "How fresh is the data?",
                  a: "Underlying rate data is updated weekly. Capacity signals are near real-time from load board aggregates. Monthly brief is compiled 5 days before delivery to capture the latest signals.",
                },
                {
                  q: "We already use DAT Basic.",
                  a: "DAT Basic shows you what rates ARE. We show you what they're about to DO — and why. That's the gap between reacting and planning.",
                },
                {
                  q: "What if your forecasts are wrong?",
                  a: "They won't be perfect — no forecast is. But if our directional signal is right 70% of the time, you're pricing smarter than your competition. We stand behind it with a free first brief so you can evaluate before spending anything.",
                },
              ].map((item) => (
                <Card key={item.q} className="bg-card border-border/40">
                  <CardContent className="p-5">
                    <dt className="font-semibold text-foreground mb-2">{item.q}</dt>
                    <dd className="text-sm text-muted-foreground leading-relaxed">{item.a}</dd>
                  </CardContent>
                </Card>
              ))}
            </dl>
          </div>
        </section>

        <Separator className="opacity-20" />

        {/* ── SB7 §7: CALL TO ACTION ────────────────────────────────────── */}
        <section id="get-started" aria-labelledby="cta-heading" className="py-24 px-4 text-center relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full bg-primary/8 blur-[100px]" />
          </div>

          <div className="max-w-xl mx-auto relative">
            <Badge className="mb-6 bg-primary/15 text-primary border border-primary/30">
              Limited founding pilot cohort
            </Badge>
            <h2 id="cta-heading" className="text-3xl sm:text-4xl font-bold mb-4">
              Get your first lane brief free.
            </h2>
            <p className="text-muted-foreground mb-8">
              Tell us your top lane and we&apos;ll send you a custom freight intelligence brief —
              no credit card, no commitment.
            </p>

            {submitted ? (
              <Card className="bg-primary/10 border-primary/40 p-8" role="alert" aria-live="polite">
                <p className="text-2xl mb-2" aria-hidden="true">✓</p>
                <p className="font-semibold text-foreground mb-2">You&apos;re on the list.</p>
                <p className="text-sm text-muted-foreground">
                  We&apos;ll reach out within 24 hours to confirm your lane and send your free brief.
                </p>
              </Card>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 justify-center" aria-label="Get your free lane brief">
                <label htmlFor="name-input" className="sr-only">Full name</label>
                <Input
                  id="name-input"
                  type="text"
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoComplete="name"
                  className="bg-muted/50 border-border/60 sm:w-44 h-11"
                />
                <label htmlFor="email-input" className="sr-only">Email address</label>
                <Input
                  id="email-input"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="bg-muted/50 border-border/60 sm:w-64 h-11"
                />
                <Button
                  type="submit"
                  size="lg"
                  disabled={submitting}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 h-11 px-8"
                >
                  {submitting ? "Sending…" : "Get Your Free Lane Brief"}
                </Button>
              </form>
            )}

            <p className="mt-4 text-xs text-muted-foreground">
              No spam. Just your brief. Reply to cancel any time.
            </p>
          </div>
        </section>

      </main>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="border-t border-border/40 py-12 px-4 bg-card/20" role="contentinfo">
        <div className="max-w-6xl mx-auto">
          <div className="grid sm:grid-cols-4 gap-8 mb-8">
            {/* Brand */}
            <div className="sm:col-span-2">
              <a href="/" aria-label="LaneBrief — home" className="flex items-center gap-2 mb-3">
                <span className="text-primary font-bold text-lg" aria-hidden="true">▸</span>
                <span className="font-bold text-lg text-foreground">LaneBrief</span>
              </a>
              <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
                AI-powered freight intelligence for independent brokers. Lane-level freight market data,
                rate forecasts, and capacity signals.
              </p>
              <p className="mt-3 text-xs text-muted-foreground">
                <a href="mailto:intel@lanebrief.com" className="hover:text-foreground transition-colors">
                  intel@lanebrief.com
                </a>
              </p>
            </div>

            {/* Product */}
            <nav aria-label="Product links">
              <h3 className="text-sm font-semibold text-foreground mb-3">Product</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#how-it-works" className="hover:text-foreground transition-colors">How it works</a></li>
                <li><a href="#sample" className="hover:text-foreground transition-colors">Sample report</a></li>
                <li><a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a></li>
                <li><a href="#get-started" className="hover:text-foreground transition-colors">Get started</a></li>
              </ul>
            </nav>

            {/* Company + Social */}
            <nav aria-label="Company links">
              <h3 className="text-sm font-semibold text-foreground mb-3">Company</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <a
                    href="https://linkedin.com/company/lanebrief"
                    className="hover:text-foreground transition-colors"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="LaneBrief on LinkedIn (opens in new tab)"
                  >
                    LinkedIn
                  </a>
                </li>
                <li>
                  <a
                    href="https://twitter.com/lanebrief"
                    className="hover:text-foreground transition-colors"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="LaneBrief on X / Twitter (opens in new tab)"
                  >
                    X / Twitter
                  </a>
                </li>
                <li><a href="mailto:nick@lanebrief.com" className="hover:text-foreground transition-colors">Contact</a></li>
              </ul>
            </nav>
          </div>

          <Separator className="opacity-20 mb-6" />

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
            <p>© 2026 LaneBrief. All rights reserved.</p>
            <nav aria-label="Legal links" className="flex gap-4">
              <a href="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</a>
              <a href="/terms" className="hover:text-foreground transition-colors">Terms of Service</a>
            </nav>
          </div>
        </div>
      </footer>

    </div>
  );
}
