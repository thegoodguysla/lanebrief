"use client";

import { useState } from "react";
import { sendGAEvent } from "@next/third-parties/google";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export default function FreeReportPage() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    lane1: "",
    lane2: "",
    lane3: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.lane1) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          lanes: [form.lane1, form.lane2, form.lane3].filter(Boolean).join(", "),
          type: "lane_health_check",
          utmSource: new URLSearchParams(window.location.search).get("utm_source") ?? undefined,
          utmCampaign: new URLSearchParams(window.location.search).get("utm_campaign") ?? undefined,
        }),
      });
      if (!res.ok) throw new Error("Request failed");
      sendGAEvent("event", "form_submit", {
        form_name: "lane_health_check",
        utm_campaign: new URLSearchParams(window.location.search).get("utm_campaign") ?? "direct",
      });
      setSubmitted(true);
    } catch {
      setError("Something went wrong — please try again or email nick@lanebrief.com.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col min-h-full bg-background text-foreground">
      {/* Nav */}
      <nav className="border-b border-border/60 bg-background/95 backdrop-blur sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2 font-bold text-lg text-foreground">
            <span className="text-primary">▶</span> LaneBrief
          </a>
          <a
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            See Pricing →
          </a>
        </div>
      </nav>

      <main className="flex-1">
        {/* Hero */}
        <section className="border-b border-border/40 bg-gradient-to-b from-muted/30 to-background">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 py-14 sm:py-20 text-center">
            <Badge variant="outline" className="mb-4 text-primary border-primary/40 bg-primary/5">
              Free Lane Intelligence Report
            </Badge>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground mb-4">
              Get a Free Lane Health Check — Know If You&apos;re Pricing Your Top Lanes Right
            </h1>
            <p className="text-lg text-muted-foreground max-w-xl mx-auto">
              Enter your 3 most-run lanes. We&apos;ll tell you if you&apos;re above or below market,
              and where you&apos;re leaving money on the table.
            </p>
          </div>
        </section>

        {/* Form + What You Get */}
        <section className="max-w-2xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
          <div className="grid sm:grid-cols-5 gap-10 items-start">
            {/* Form */}
            <div className="sm:col-span-3">
              {submitted ? (
                <div className="rounded-xl border border-primary/30 bg-primary/5 p-8 text-center">
                  <div className="text-4xl mb-4">✓</div>
                  <h2 className="text-xl font-bold mb-2">Your report is on its way.</h2>
                  <p className="text-muted-foreground text-sm">
                    Check your inbox — we&apos;ll send your Lane Health Check within minutes. If you
                    don&apos;t see it, check spam or email{" "}
                    <a
                      href="mailto:nick@lanebrief.com"
                      className="text-primary underline underline-offset-2"
                    >
                      nick@lanebrief.com
                    </a>
                    .
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1.5" htmlFor="name">
                      Your Name
                    </label>
                    <Input
                      id="name"
                      name="name"
                      placeholder="First Last"
                      value={form.name}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5" htmlFor="email">
                      Work Email
                    </label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="you@brokerage.com"
                      value={form.email}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5" htmlFor="lane1">
                      Lane 1 <span className="text-muted-foreground font-normal">(e.g. DAL → CHI)</span>
                    </label>
                    <Input
                      id="lane1"
                      name="lane1"
                      placeholder="Origin → Destination"
                      value={form.lane1}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5" htmlFor="lane2">
                      Lane 2{" "}
                      <span className="text-muted-foreground font-normal">(optional)</span>
                    </label>
                    <Input
                      id="lane2"
                      name="lane2"
                      placeholder="Origin → Destination"
                      value={form.lane2}
                      onChange={handleChange}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5" htmlFor="lane3">
                      Lane 3{" "}
                      <span className="text-muted-foreground font-normal">(optional)</span>
                    </label>
                    <Input
                      id="lane3"
                      name="lane3"
                      placeholder="Origin → Destination"
                      value={form.lane3}
                      onChange={handleChange}
                    />
                  </div>

                  {error && <p className="text-sm text-destructive">{error}</p>}

                  <Button
                    type="submit"
                    size="lg"
                    disabled={submitting || !form.name || !form.email || !form.lane1}
                    className="w-full font-semibold"
                  >
                    {submitting ? "Sending…" : "Send My Free Report"}
                  </Button>

                  <p className="text-xs text-center text-muted-foreground">
                    No credit card. Used by freight brokers managing $1M–$10M/year in loads.
                  </p>
                </form>
              )}
            </div>

            {/* What You Get */}
            <div className="sm:col-span-2">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-4">
                What&apos;s in your report
              </h2>
              <ul className="space-y-3 text-sm">
                {[
                  { icon: "📊", label: "30-Day Rate Trend", sub: "Spot movement vs. contract benchmark" },
                  { icon: "🚛", label: "Capacity Index", sub: "Tight / Normal / Loose with context" },
                  { icon: "⚠️", label: "Seasonal Risk Flag", sub: "Forward-looking capacity alerts" },
                  { icon: "💡", label: "3 Intelligence Bullets", sub: "Data-backed lane-specific insights" },
                  { icon: "🎯", label: "Rate Protection Rec", sub: "What to do with this intel" },
                  { icon: "📦", label: "Lane Overview", sub: "Avg haul, freight class mix" },
                ].map(({ icon, label, sub }) => (
                  <li key={label} className="flex gap-3 items-start">
                    <span className="text-base mt-0.5">{icon}</span>
                    <div>
                      <span className="font-medium">{label}</span>
                      <p className="text-muted-foreground text-xs mt-0.5">{sub}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Social Proof */}
        <section className="border-t border-border/40 bg-muted/20">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 sm:py-14 text-center">
            <p className="text-sm text-muted-foreground mb-6 uppercase tracking-widest font-medium">
              Built for independent freight brokers
            </p>
            <blockquote className="text-lg sm:text-xl font-medium text-foreground max-w-lg mx-auto leading-relaxed">
              &ldquo;Protect one load margin per month = $600+ saved. LaneBrief starts at $199/mo.
              It pays for itself the first time you quote before a rate spike — not after.&rdquo;
            </blockquote>
            <p className="mt-4 text-sm text-muted-foreground">— Nick Taylor, Founder, LaneBrief</p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/40 py-6">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} LaneBrief · All rights reserved</span>
          <a href="mailto:nick@lanebrief.com" className="hover:text-foreground transition-colors">
            nick@lanebrief.com
          </a>
        </div>
      </footer>
    </div>
  );
}
