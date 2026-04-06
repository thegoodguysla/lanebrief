"use client";

import { useState } from "react";
import Link from "next/link";
import { sendGAEvent } from "@next/third-parties/google";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function SampleReportPage() {
  const [form, setForm] = useState({
    email: "",
    lane1: "",
    lane2: "",
    lane3: "",
    equipment: "dry_van",
  });
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.lane1) return;
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/sample-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.email,
          lane1: form.lane1,
          lane2: form.lane2 || undefined,
          lane3: form.lane3 || undefined,
          equipment: form.equipment,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || "Request failed");
      }

      sendGAEvent("event", "form_submit", { form_name: "sample_report_lead" });
      setSubmitted(true);
    } catch (err) {
      setError(
        err instanceof Error && err.message !== "Request failed"
          ? err.message
          : "Something went wrong — please try again or email nick@lanebrief.com."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="border-b border-border/60 bg-background/95 backdrop-blur sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg">
            <span className="text-primary">▶</span> LaneBrief
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/sign-in" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Sign in
            </Link>
            <Link
              href="/sign-up"
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Start free trial
            </Link>
          </div>
        </div>
      </nav>

      <main className="flex-1">
        {/* Hero */}
        <section className="border-b border-border/40 bg-gradient-to-b from-muted/30 to-background">
          <div className="max-w-2xl mx-auto px-4 py-12 text-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary mb-4">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              Free — No account required
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
              Get a free freight market report for your lanes
            </h1>
            <p className="text-lg text-muted-foreground max-w-xl mx-auto">
              Enter your top 3 lanes + email. We&apos;ll send you a full LaneBrief Intelligence Report —
              free, no credit card.
            </p>
          </div>
        </section>

        {/* Form + Benefits */}
        <section className="max-w-2xl mx-auto px-4 py-10">
          <div className="grid sm:grid-cols-5 gap-10 items-start">
            {/* Form */}
            <div className="sm:col-span-3">
              {submitted ? (
                <div className="rounded-xl border border-primary/30 bg-primary/5 p-8 text-center space-y-4">
                  <div className="text-5xl">✓</div>
                  <h2 className="text-xl font-bold">Your report is on its way!</h2>
                  <p className="text-muted-foreground text-sm">
                    Check your inbox — your LaneBrief Intelligence Report will arrive within 60 seconds.
                    If you don&apos;t see it, check spam.
                  </p>
                  <div className="pt-2 border-t border-border/40">
                    <p className="text-sm font-medium mb-3">
                      Want to track these lanes daily?
                    </p>
                    <Link
                      href="/sign-up"
                      className="inline-block rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
                    >
                      Start free trial →
                    </Link>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1.5" htmlFor="email">
                      Email address
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
                      Lane 1 <span className="text-muted-foreground font-normal">(required)</span>
                    </label>
                    <Input
                      id="lane1"
                      name="lane1"
                      placeholder="Chicago, IL → Dallas, TX"
                      value={form.lane1}
                      onChange={handleChange}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1.5" htmlFor="lane2">
                      Lane 2 <span className="text-muted-foreground font-normal">(optional)</span>
                    </label>
                    <Input
                      id="lane2"
                      name="lane2"
                      placeholder="Los Angeles, CA → Phoenix, AZ"
                      value={form.lane2}
                      onChange={handleChange}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1.5" htmlFor="lane3">
                      Lane 3 <span className="text-muted-foreground font-normal">(optional)</span>
                    </label>
                    <Input
                      id="lane3"
                      name="lane3"
                      placeholder="Atlanta, GA → New York, NY"
                      value={form.lane3}
                      onChange={handleChange}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1.5" htmlFor="equipment">
                      Equipment type
                    </label>
                    <select
                      id="equipment"
                      name="equipment"
                      value={form.equipment}
                      onChange={handleChange}
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      <option value="dry_van">Dry Van</option>
                      <option value="reefer">Reefer</option>
                      <option value="flatbed">Flatbed</option>
                    </select>
                  </div>

                  {error && <p className="text-sm text-destructive">{error}</p>}

                  <Button
                    type="submit"
                    size="lg"
                    disabled={submitting || !form.email || !form.lane1}
                    className="w-full font-semibold"
                  >
                    {submitting ? "Generating your report…" : "Send my free report"}
                  </Button>

                  <p className="text-xs text-center text-muted-foreground">
                    No spam. Unsubscribe anytime. Used by 100+ freight brokers.
                  </p>
                </form>
              )}
            </div>

            {/* What's included */}
            <div className="sm:col-span-2">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-4">
                What&apos;s in your report
              </h2>
              <ul className="space-y-3 text-sm">
                {[
                  { icon: "📈", label: "Spot rate estimate", sub: "Current $/mi for your equipment + lane" },
                  { icon: "🚛", label: "Capacity signal", sub: "Tight / moderate / loose index" },
                  { icon: "📦", label: "Carrier recommendation", sub: "Best carrier type for this corridor" },
                  { icon: "⚠️", label: "Tariff alerts", sub: "US-MX & US-CA tariff exposure flags" },
                  { icon: "💡", label: "Market intelligence", sub: "AI-powered lane insight for this week" },
                ].map(({ icon, label, sub }) => (
                  <li key={label} className="flex gap-3 items-start">
                    <span className="text-base mt-0.5 shrink-0">{icon}</span>
                    <div>
                      <span className="font-medium">{label}</span>
                      <p className="text-muted-foreground text-xs mt-0.5">{sub}</p>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="mt-6 rounded-lg border border-border bg-muted/30 p-4 text-sm">
                <p className="font-medium mb-1">Already have an account?</p>
                <Link href="/sign-in" className="text-primary hover:underline text-sm">
                  Sign in to view your personalized portfolio →
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Social proof */}
        <section className="border-t border-border/40 bg-muted/20">
          <div className="max-w-2xl mx-auto px-4 py-10 text-center">
            <p className="text-sm text-muted-foreground mb-4 uppercase tracking-widest font-medium">
              Built for independent freight brokers
            </p>
            <blockquote className="text-lg font-medium text-foreground max-w-lg mx-auto leading-relaxed">
              &ldquo;Protect one load margin per month = $600+ saved. LaneBrief starts at $199/mo.
              It pays for itself the first time you quote before a rate spike.&rdquo;
            </blockquote>
            <p className="mt-3 text-sm text-muted-foreground">— Nick Taylor, Founder, LaneBrief</p>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/40 py-6">
        <div className="max-w-4xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} LaneBrief · All rights reserved</span>
          <a href="mailto:nick@lanebrief.com" className="hover:text-foreground transition-colors">
            nick@lanebrief.com
          </a>
        </div>
      </footer>
    </div>
  );
}
