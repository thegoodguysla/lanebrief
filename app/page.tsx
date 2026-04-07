"use client";

import { useState, useEffect } from "react";
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

  // Carrier Reliability Mini-Score state
  const [csCarrier, setCsCarrier] = useState("");
  const [csLane, setCsLane] = useState("");
  const [csLoading, setCsLoading] = useState(false);
  const [csResult, setCsResult] = useState<{
    score: number;
    grade: "A" | "B" | "C" | "D" | "F";
    summary: string;
    strengths: string[];
    risks: string[];
    disclaimer: string;
  } | null>(null);
  const [csError, setCsError] = useState<string | null>(null);

  // A/B test: Scout pricing — "control" ($199) vs "test" ($299)
  const [priceVariant, setPriceVariant] = useState<"control" | "test">("control");

  // ROI calculator state
  const [roiLoads, setRoiLoads] = useState("20");
  const [roiRevPerLoad, setRoiRevPerLoad] = useState("3500");
  const [roiMarginPct, setRoiMarginPct] = useState("12");
  const [roiResult, setRoiResult] = useState<{
    monthlyGain: number;
    annualGain: number;
    multiple: number;
  } | null>(null);


  const handleCarrierScore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!csCarrier || !csLane) return;
    setCsLoading(true);
    setCsResult(null);
    setCsError(null);
    try {
      const res = await fetch("/api/carrier-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ carrier_name: csCarrier, lane: csLane }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setCsError(err.error || "Something went wrong. Try again.");
      } else {
        const data = await res.json();
        setCsResult(data);
        sendGAEvent("event", "form_submit", { form_name: "carrier_reliability_score" });
      }
    } catch {
      setCsError("Network error. Please try again.");
    } finally {
      setCsLoading(false);
    }
  };

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

  // A/B test: assign variant on mount, persist in localStorage
  useEffect(() => {
    let variant = localStorage.getItem("lb_ab_scout_price") as "control" | "test" | null;
    if (variant !== "control" && variant !== "test") {
      variant = Math.random() < 0.5 ? "control" : "test";
      localStorage.setItem("lb_ab_scout_price", variant);
    }
    setPriceVariant(variant);
    sendGAEvent("event", "ab_test_exposure", {
      test_name: "scout_price_apr2026",
      variant,
      price: variant === "control" ? 199 : 299,
    });
  }, []);

  const handleRoiCalc = (e: React.FormEvent) => {
    e.preventDefault();
    const loads = parseFloat(roiLoads);
    const rev = parseFloat(roiRevPerLoad);
    const margin = parseFloat(roiMarginPct);
    if (isNaN(loads) || isNaN(rev) || isNaN(margin) || loads <= 0 || rev <= 0 || margin <= 0) return;

    const loadsPerMonth = (loads * 52) / 12;
    const currentMonthlyMargin = loadsPerMonth * rev * (margin / 100);
    // Conservative estimate: 5% margin improvement from better lane intelligence
    const monthlyGain = currentMonthlyMargin * 0.05;
    const annualGain = monthlyGain * 12;
    const multiple = annualGain / (199 * 12);

    setRoiResult({ monthlyGain, annualGain, multiple });
    sendGAEvent("event", "roi_calculator_submit", {
      loads_per_week: loads,
      avg_rev_per_load: rev,
      margin_pct: margin,
      estimated_annual_gain: Math.round(annualGain),
    });
  };

  const handleScoutCTAClick = () => {
    sendGAEvent("event", "pricing_cta_click", {
      plan: "scout",
      test_name: "scout_price_apr2026",
      variant: priceVariant,
      price: priceVariant === "control" ? 199 : 299,
    });
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
            <a href="#carrier-score" className="hover:text-foreground transition-colors">Carrier score</a>
            <a href="#av-intel" className="hover:text-foreground transition-colors">AV Intel</a>
            <a href="/pricing" className="hover:text-foreground transition-colors">Pricing</a>
            <a href="/sample-report" className="hover:text-foreground transition-colors font-medium text-primary">Free Sample Report</a>
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
            <a href="/demo" className={cn(buttonVariants({ size: "lg", variant: "outline" }), "text-base border-border/60 hover:bg-muted/50")}>
              Book a Demo →
            </a>
          </div>

          <p className="mt-4 text-sm text-muted-foreground">
            No credit card. No commitment. Just data.
          </p>

          <p className="mt-6 text-sm text-muted-foreground">
            Or{" "}
            <a href="#benchmarker" className="underline underline-offset-2 hover:text-foreground transition-colors font-medium">
              check your rate for free →
            </a>
            {" "}Enter a lane + rate per mile. Know if you&apos;re above or below market in 10 seconds.
          </p>

          {/* Stat strip */}
          <div className="mt-16 grid grid-cols-3 gap-6 sm:gap-12 max-w-xl w-full" role="list" aria-label="Key statistics">
            {[
              { label: "Analyst-grade briefs", value: "From $199/mo" },
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

        {/* ── Carrier Reliability Mini-Score ───────────────────────────── */}
        <section id="carrier-score" aria-labelledby="carrier-score-heading" className="py-20 px-4">
          <div className="max-w-2xl mx-auto">
            <Card className="bg-card border-border/40">
              <CardHeader className="pb-2">
                <Badge className="w-fit mb-3 bg-primary/20 text-primary border-primary/30 text-xs">AI-Estimated · Free</Badge>
                <CardTitle>
                  <h2 id="carrier-score-heading" className="text-3xl sm:text-4xl font-bold">
                    Carrier Reliability Score
                  </h2>
                </CardTitle>
                <p className="text-muted-foreground mt-2">
                  Enter a carrier name and lane. Get an AI-synthesized 0–100 reliability score with strengths and risk flags in seconds.
                </p>
              </CardHeader>
              <CardContent className="pt-4">
                <form onSubmit={handleCarrierScore} className="space-y-4" aria-label="Carrier reliability scorer">
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label htmlFor="cs-carrier" className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                        Carrier Name
                      </label>
                      <Input
                        id="cs-carrier"
                        placeholder="e.g. Swift Transportation"
                        value={csCarrier}
                        onChange={(e) => setCsCarrier(e.target.value)}
                        maxLength={100}
                        required
                        className="bg-background/60"
                        aria-describedby="cs-carrier-hint"
                      />
                      <p id="cs-carrier-hint" className="text-xs text-muted-foreground/60">MC number or DBA name</p>
                    </div>
                    <div className="space-y-1">
                      <label htmlFor="cs-lane" className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                        Lane
                      </label>
                      <Input
                        id="cs-lane"
                        placeholder="e.g. Chicago, IL to Dallas, TX"
                        value={csLane}
                        onChange={(e) => setCsLane(e.target.value)}
                        maxLength={200}
                        required
                        className="bg-background/60"
                      />
                    </div>
                  </div>
                  <Button
                    type="submit"
                    className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                    disabled={csLoading || !csCarrier || !csLane}
                    aria-busy={csLoading}
                  >
                    {csLoading ? "Scoring carrier…" : "Score This Carrier"}
                  </Button>
                </form>

                {csError && (
                  <div role="alert" className="mt-6 p-4 rounded-lg border border-destructive/40 bg-destructive/10 text-sm text-destructive">
                    {csError}
                  </div>
                )}

                {csResult && (
                  <div role="region" aria-label="Carrier reliability result" className="mt-6 space-y-4">
                    {/* Score + Grade */}
                    <div className={cn(
                      "p-5 rounded-lg border flex items-center gap-6",
                      csResult.score >= 80 && "border-green-500/40 bg-green-500/10",
                      csResult.score >= 60 && csResult.score < 80 && "border-yellow-500/40 bg-yellow-500/10",
                      csResult.score < 60 && "border-destructive/40 bg-destructive/10",
                    )}>
                      <div className="shrink-0 text-center">
                        <p className={cn(
                          "text-5xl font-bold font-mono leading-none",
                          csResult.score >= 80 && "text-green-400",
                          csResult.score >= 60 && csResult.score < 80 && "text-yellow-400",
                          csResult.score < 60 && "text-destructive",
                        )}>
                          {csResult.score}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">out of 100</p>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={cn(
                            "text-2xl font-bold",
                            csResult.score >= 80 && "text-green-400",
                            csResult.score >= 60 && csResult.score < 80 && "text-yellow-400",
                            csResult.score < 60 && "text-destructive",
                          )}>
                            Grade {csResult.grade}
                          </span>
                        </div>
                        <div className="bg-background/40 rounded-full h-2 overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all",
                              csResult.score >= 80 && "bg-green-500",
                              csResult.score >= 60 && csResult.score < 80 && "bg-yellow-500",
                              csResult.score < 60 && "bg-destructive",
                            )}
                            style={{ width: `${csResult.score}%` }}
                            aria-hidden="true"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Summary */}
                    <p className="text-sm text-muted-foreground leading-relaxed">{csResult.summary}</p>

                    {/* Strengths + Risks */}
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-4">
                        <p className="text-xs font-semibold text-green-400 uppercase tracking-wide mb-2">Strengths</p>
                        <ul className="space-y-1.5">
                          {csResult.strengths.map((s, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                              <span className="text-green-400 shrink-0 mt-0.5" aria-hidden="true">✓</span>
                              {s}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-4">
                        <p className="text-xs font-semibold text-yellow-400 uppercase tracking-wide mb-2">Risk Flags</p>
                        <ul className="space-y-1.5">
                          {csResult.risks.map((r, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                              <span className="text-yellow-400 shrink-0 mt-0.5" aria-hidden="true">!</span>
                              {r}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground text-center">{csResult.disclaimer}</p>

                    <div className="text-center pt-2">
                      <p className="text-sm text-muted-foreground mb-3">Want full carrier vetting + lane health in your weekly brief?</p>
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

        {/* ── Autonomous Fleet Intel ────────────────────────────────────── */}
        <section id="av-intel" aria-labelledby="av-intel-heading" className="py-20 px-4 bg-card/20">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-10">
              <Badge className="mb-4 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-xs">
                Beta · Navigator &amp; Command plans
              </Badge>
              <h2 id="av-intel-heading" className="text-3xl sm:text-4xl font-bold">
                Autonomous Fleet Intel
              </h2>
              <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
                The freight industry is shifting. Know which of your lanes have autonomous carrier coverage — and what it means for capacity, rates, and your competitive position.
              </p>
            </div>

            <div className="grid sm:grid-cols-3 gap-6 mb-8">
              {[
                {
                  badge: "AV: Covered",
                  badgeClass: "border-emerald-400/60 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400",
                  dotClass: "bg-emerald-500",
                  title: "Full AV Coverage",
                  desc: "Fully certified autonomous carriers operating on this lane. Expect evolving capacity dynamics and new rate floors as AV adoption scales.",
                },
                {
                  badge: "AV: Partial",
                  badgeClass: "border-amber-400/60 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400",
                  dotClass: "bg-amber-500",
                  title: "Provisional Certification",
                  desc: "AV carriers with lane-segment approval. Coverage is active but limited — watch for capacity shifts over the next 12–24 months.",
                },
                {
                  badge: "AV: None",
                  badgeClass: "border-border/60 bg-muted/20 text-muted-foreground",
                  dotClass: "bg-muted-foreground/50",
                  title: "No AV Activity",
                  desc: "No autonomous carrier operations on this lane. Traditional capacity dynamics apply — no near-term disruption risk.",
                },
              ].map((item) => (
                <Card key={item.title} className="bg-card border-border/50">
                  <CardHeader className="pb-3">
                    <span className={cn(
                      "inline-flex items-center gap-1.5 w-fit rounded-full border px-2.5 py-1 text-xs font-medium mb-3",
                      item.badgeClass
                    )}>
                      <span className={cn("h-1.5 w-1.5 rounded-full", item.dotClass)} aria-hidden="true" />
                      {item.badge}
                    </span>
                    <CardTitle className="text-base">{item.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="max-w-2xl mx-auto rounded-lg border border-border/40 bg-card/60 p-6 text-center">
              <p className="text-sm font-medium mb-1">Why this matters for independent brokers</p>
              <p className="text-sm text-muted-foreground">
                AV penetration changes lane-level supply. Knowing your corridors&apos; AV status gives you a 12–18 month leading edge on capacity shifts — before they hit DAT.
              </p>
              <a href="#get-started" className={cn(buttonVariants({ size: "sm", variant: "outline" }), "mt-4 border-primary/40 text-primary hover:bg-primary/10")}>
                Get early access →
              </a>
            </div>
          </div>
        </section>

        <Separator className="opacity-20" />

        {/* ── Pricing ──────────────────────────────────────────────────── */}
        <section id="pricing" aria-labelledby="pricing-heading" className="py-20 px-4">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <h2 id="pricing-heading" className="text-3xl sm:text-4xl font-bold">Simple, transparent pricing.</h2>
              <p className="mt-4 text-muted-foreground max-w-lg mx-auto">
                Three plans. No hidden fees. Cancel any time.
                Save 2 months with annual billing.
              </p>
            </div>

            <div className="grid sm:grid-cols-3 gap-6 items-start max-w-4xl mx-auto mb-12">
              {/* Scout — A/B test: control=$199 / test=$299 */}
              <Card className="border-border/40">
                <CardHeader>
                  <CardTitle className="text-xl">Scout</CardTitle>
                  <p className="text-sm text-muted-foreground">3 lanes</p>
                  <div className="flex items-end gap-2 mt-2">
                    <span className="text-4xl font-bold text-foreground" suppressHydrationWarning>
                      {priceVariant === "test" ? "$299" : "$199"}
                    </span>
                    <span className="text-muted-foreground mb-1">/mo</span>
                  </div>
                  <p className="text-xs text-muted-foreground" suppressHydrationWarning>
                    {priceVariant === "test" ? "or $2,990/yr (2 months free)" : "or $1,990/yr (2 months free)"}
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-3 text-sm" aria-label="Scout features">
                    {[
                      "Monthly intelligence brief — 3 lanes",
                      "30-day rate forecast",
                      "Capacity tightness indicators",
                      "Actionable pricing recs",
                      "Weekly capacity alerts",
                      "Analyst access via email",
                    ].map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <span className="text-primary mt-0.5 shrink-0" aria-hidden="true">✓</span>
                        <span className="text-muted-foreground">{item}</span>
                      </li>
                    ))}
                  </ul>
                  {/* TODO: create $299 Stripe link for test variant before launch */}
                  <a
                    href="https://buy.stripe.com/cNicMY58JckwaGl03s1Nu06"
                    onClick={handleScoutCTAClick}
                    className={cn(buttonVariants({ variant: "outline" }), "w-full mt-4 justify-center")}
                    suppressHydrationWarning
                  >
                    {priceVariant === "test" ? "Get Scout — $299/mo" : "Get Scout — $199/mo"}
                  </a>
                  <a href="https://buy.stripe.com/dRmcMY7gRbgs7u9aI61Nu07" className="block text-xs text-center text-primary underline underline-offset-2 hover:text-primary/80 transition-colors mt-2">
                    Save with annual billing
                  </a>
                </CardContent>
              </Card>

              {/* Navigator — recommended */}
              <Card className="bg-primary/10 border-primary/40 relative overflow-hidden">
                <div className="absolute top-0 right-0 m-3">
                  <Badge className="bg-primary text-primary-foreground text-xs">Most Popular</Badge>
                </div>
                <CardHeader>
                  <CardTitle className="text-xl">Navigator</CardTitle>
                  <p className="text-sm text-muted-foreground">5 lanes</p>
                  <div className="flex items-end gap-2 mt-2">
                    <span className="text-4xl font-bold text-primary">$349</span>
                    <span className="text-muted-foreground mb-1">/mo</span>
                  </div>
                  <p className="text-xs text-muted-foreground">or $3,490/yr (2 months free)</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-3 text-sm" aria-label="Navigator features">
                    {[
                      "Monthly intelligence brief — 5 lanes",
                      "30-day rate forecast with confidence ranges",
                      "Capacity tightness indicators",
                      "Actionable pricing recs",
                      "Rate Alerts (weekly capacity digest)",
                      "Analyst access via email",
                      "Autonomous Fleet Intel (beta)",
                    ].map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <span className="text-primary mt-0.5 shrink-0" aria-hidden="true">✓</span>
                        <span className="text-muted-foreground">{item}</span>
                      </li>
                    ))}
                  </ul>
                  <a href="https://buy.stripe.com/9B614g8kV4S4eWB4jI1Nu08" className={cn(buttonVariants(), "w-full bg-primary text-primary-foreground hover:bg-primary/90 mt-4 justify-center")}>
                    Get Navigator — $349/mo
                  </a>
                  <a href="https://buy.stripe.com/6oUcMY6cN0BO3dT17w1Nu09" className="block text-xs text-center text-primary underline underline-offset-2 hover:text-primary/80 transition-colors mt-2">
                    Save $698/yr with annual billing
                  </a>
                  <a href="#get-started" className="block text-xs text-center text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors mt-1">
                    Or try a free sample brief first
                  </a>
                </CardContent>
              </Card>

              {/* Command */}
              <Card className="border-border/40">
                <CardHeader>
                  <CardTitle className="text-xl">Command</CardTitle>
                  <p className="text-sm text-muted-foreground">10 lanes</p>
                  <div className="flex items-end gap-2 mt-2">
                    <span className="text-4xl font-bold text-foreground">$599</span>
                    <span className="text-muted-foreground mb-1">/mo</span>
                  </div>
                  <p className="text-xs text-muted-foreground">or $5,990/yr (2 months free)</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-3 text-sm" aria-label="Command features">
                    {[
                      "Monthly intelligence brief — 10 lanes",
                      "30-day rate forecast with confidence ranges",
                      "Capacity tightness indicators",
                      "Actionable pricing recs",
                      "Rate Alerts (weekly capacity digest)",
                      "Priority analyst access",
                      "Autonomous Fleet Intel (beta)",
                    ].map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <span className="text-primary mt-0.5 shrink-0" aria-hidden="true">✓</span>
                        <span className="text-muted-foreground">{item}</span>
                      </li>
                    ))}
                  </ul>
                  <a href="https://buy.stripe.com/eVq4gs1Wx5W8cOt7vU1Nu0a" className={cn(buttonVariants({ variant: "outline" }), "w-full mt-4 justify-center")}>
                    Get Command — $599/mo
                  </a>
                  <a href="https://buy.stripe.com/8x2fZaeJjesEdSx4jI1Nu0b" className="block text-xs text-center text-primary underline underline-offset-2 hover:text-primary/80 transition-colors mt-2">
                    Save $1,198/yr with annual billing
                  </a>
                </CardContent>
              </Card>
            </div>

            <p className="text-center text-sm text-muted-foreground mb-12">
              Need more than 10 lanes? <a href="mailto:nick@lanebrief.com" className="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors">Contact our sales team</a> for a custom quote.
            </p>

            {/* ROI Calculator */}
            <div className="max-w-2xl mx-auto mb-16">
              <Card className="border-primary/30 bg-primary/5">
                <CardHeader>
                  <CardTitle className="text-xl">Calculate your ROI</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    See how much better lane intelligence could add to your bottom line.
                    Based on a conservative 5% margin improvement from smarter pricing decisions.
                  </p>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleRoiCalc} className="space-y-4" aria-label="ROI calculator">
                    <div className="grid sm:grid-cols-3 gap-4">
                      <div className="space-y-1">
                        <label htmlFor="roi-loads" className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                          Loads / week
                        </label>
                        <Input
                          id="roi-loads"
                          type="number"
                          min="1"
                          step="1"
                          value={roiLoads}
                          onChange={(e) => setRoiLoads(e.target.value)}
                          placeholder="20"
                        />
                      </div>
                      <div className="space-y-1">
                        <label htmlFor="roi-rev" className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                          Avg revenue / load
                        </label>
                        <Input
                          id="roi-rev"
                          type="number"
                          min="100"
                          step="100"
                          value={roiRevPerLoad}
                          onChange={(e) => setRoiRevPerLoad(e.target.value)}
                          placeholder="3500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label htmlFor="roi-margin" className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                          Gross margin %
                        </label>
                        <Input
                          id="roi-margin"
                          type="number"
                          min="1"
                          max="100"
                          step="0.5"
                          value={roiMarginPct}
                          onChange={(e) => setRoiMarginPct(e.target.value)}
                          placeholder="12"
                        />
                      </div>
                    </div>
                    <button type="submit" className={cn(buttonVariants(), "w-full bg-primary text-primary-foreground hover:bg-primary/90")}>
                      Calculate my ROI →
                    </button>
                  </form>

                  {roiResult && (
                    <div className="mt-6 pt-6 border-t border-border/40" role="region" aria-label="ROI results" aria-live="polite">
                      <div className="grid sm:grid-cols-3 gap-4 text-center">
                        <div>
                          <p className="font-mono text-2xl font-bold text-primary">
                            ${Math.round(roiResult.monthlyGain).toLocaleString()}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">Est. monthly gain</p>
                        </div>
                        <div>
                          <p className="font-mono text-2xl font-bold text-primary">
                            ${Math.round(roiResult.annualGain).toLocaleString()}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">Est. annual gain</p>
                        </div>
                        <div>
                          <p className="font-mono text-2xl font-bold text-primary">
                            {roiResult.multiple.toFixed(1)}×
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">Return on subscription</p>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground text-center mt-4">
                        Estimate based on a 5% margin improvement from better lane intelligence.
                        Actual results vary by lane mix and market conditions.
                      </p>
                      <a href="#get-started" className={cn(buttonVariants({ variant: "outline" }), "w-full mt-4 justify-center")}>
                        Get your free lane brief to see the data →
                      </a>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Competitor comparison */}
            <div className="max-w-2xl mx-auto space-y-4">
              <p className="text-sm text-muted-foreground font-medium uppercase tracking-widest mb-6 text-center">How we compare</p>
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
                  price: "from $199/mo",
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

        {/* ── What's Coming ────────────────────────────────────────────── */}
        <section id="coming-soon" aria-labelledby="coming-soon-heading" className="py-20 px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-10">
              <Badge className="mb-4 bg-muted text-muted-foreground border border-border/60 text-xs tracking-wide">
                What&apos;s Coming
              </Badge>
              <h2 id="coming-soon-heading" className="text-2xl sm:text-3xl font-bold mb-3">
                More intelligence, launching soon
              </h2>
              <p className="text-muted-foreground text-sm max-w-md mx-auto">
                We&apos;re building the next layer of freight intelligence. Here&apos;s what&apos;s on deck.
              </p>
            </div>

            <div className="grid sm:grid-cols-3 gap-5">
              <Card className="bg-card border-border/40 relative overflow-hidden">
                <div className="absolute top-3 right-3">
                  <Badge className="bg-primary/10 text-primary border border-primary/25 text-[10px] font-medium">
                    Coming Soon
                  </Badge>
                </div>
                <CardContent className="p-5 pt-6">
                  <div className="text-2xl mb-3" aria-hidden="true">🔔</div>
                  <h3 className="font-semibold text-foreground mb-2">Real-Time Lane Alerts</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Get notified the moment your lanes move more than 5% — before your competition prices you out.
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-card border-border/40 relative overflow-hidden">
                <div className="absolute top-3 right-3">
                  <Badge className="bg-primary/10 text-primary border border-primary/25 text-[10px] font-medium">
                    Coming Soon
                  </Badge>
                </div>
                <CardContent className="p-5 pt-6">
                  <div className="text-2xl mb-3" aria-hidden="true">🚧</div>
                  <h3 className="font-semibold text-foreground mb-2">Tariff Impact Flags</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    See which of your US-MX and cross-border lanes are exposed to tariff changes — in real time.
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-card border-border/40 relative overflow-hidden">
                <div className="absolute top-3 right-3">
                  <Badge className="bg-primary/10 text-primary border border-primary/25 text-[10px] font-medium">
                    Coming Soon
                  </Badge>
                </div>
                <CardContent className="p-5 pt-6">
                  <div className="text-2xl mb-3" aria-hidden="true">📊</div>
                  <h3 className="font-semibold text-foreground mb-2">Carrier Capacity Overlay</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Know when capacity tightens on your top lanes before rates spike — so you secure trucks first.
                  </p>
                </CardContent>
              </Card>
            </div>
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
                <li><a href="/pricing" className="hover:text-foreground transition-colors">Pricing</a></li>
                <li><a href="#coming-soon" className="hover:text-foreground transition-colors">Coming soon</a></li>
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
              <a href="/data-deletion" className="hover:text-foreground transition-colors">Data Deletion</a>
            </nav>
          </div>
        </div>
      </footer>

    </div>
  );
}
