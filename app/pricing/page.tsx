"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { STRIPE_PRICES } from "@/lib/stripe";
import { cn } from "@/lib/utils";

const FREE_FEATURES = [
  { label: "Up to 3 saved lanes", included: true },
  { label: "Weekly Intelligence Report", included: true },
  { label: "Basic rate lookup", included: true },
  { label: "Carrier risk score (5 lookups/day)", included: true },
  { label: "No credit card required", included: true },
  { label: "Unlimited saved lanes", included: false },
  { label: "Lane Portfolio Intelligence View", included: false },
  { label: "7-Day Rate Forecast on all lanes", included: false },
  { label: "Unlimited carrier risk scores", included: false },
  { label: "Broker Profit Calculator", included: false },
  { label: "Rate alerts + tariff flags", included: false },
  { label: "Priority email support", included: false },
];

const PRO_FEATURES = [
  { label: "Unlimited saved lanes", included: true },
  { label: "Lane Portfolio Intelligence View", included: true },
  { label: "7-Day Rate Forecast on all lanes", included: true },
  { label: "Unlimited carrier risk scores", included: true },
  { label: "Broker Profit Calculator", included: true },
  { label: "Rate alerts + tariff flags", included: true },
  { label: "Weekly Intelligence Report", included: true },
  { label: "Priority email support", included: true },
];

const FAQS = [
  {
    q: "Can I cancel anytime?",
    a: "Yes. Cancel from your billing portal at any time. Your Pro access continues until the end of the billing period.",
  },
  {
    q: "Is my data private?",
    a: "Absolutely. Your lane data, queries, and reports are private to your account and never shared.",
  },
  {
    q: "What is a saved lane?",
    a: "A lane is an origin/destination pair you track — e.g., Chicago IL → Dallas TX. Free plan supports up to 3 lanes. Pro is unlimited.",
  },
  {
    q: "What happens when I hit 3 lanes on the free plan?",
    a: "You'll see an upgrade prompt. Upgrade to Pro instantly with a card for unlimited lanes.",
  },
];

export default function PricingPage() {
  const { isSignedIn } = useUser();
  const router = useRouter();
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly");
  const [loading, setLoading] = useState<string | null>(null);

  async function handleUpgrade(priceId: string) {
    if (!isSignedIn) {
      router.push("/sign-up");
      return;
    }
    setLoading(priceId);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } finally {
      setLoading(null);
    }
  }

  const priceId = billing === "monthly" ? STRIPE_PRICES.proMonthly : STRIPE_PRICES.proAnnual;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="border-b border-border/60 bg-background/95 backdrop-blur sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="font-semibold tracking-tight">
            LaneBrief
          </Link>
          <div className="flex items-center gap-3">
            {isSignedIn ? (
              <Link href="/dashboard" className={cn(buttonVariants({ size: "sm" }))}>
                Dashboard
              </Link>
            ) : (
              <>
                <Link href="/sign-in" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Sign in
                </Link>
                <Link href="/sign-up" className={cn(buttonVariants({ size: "sm" }))}>
                  Get started free
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 py-12 sm:py-20 space-y-16">
        {/* Header */}
        <div className="text-center space-y-4">
          <p className="text-sm text-muted-foreground font-medium uppercase tracking-widest">Pricing</p>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Simple, transparent pricing</h1>
          <p className="text-muted-foreground text-lg max-w-lg mx-auto">
            Start free. Upgrade when you need more. No contracts, cancel anytime.
          </p>
          <p className="text-sm text-muted-foreground">Trusted by freight brokers across the US</p>

          {/* Billing toggle */}
          <div className="inline-flex items-center gap-2 rounded-full border border-border px-2 py-1 text-sm mt-4">
            <button
              onClick={() => setBilling("monthly")}
              className={cn(
                "px-4 py-1.5 rounded-full transition-colors",
                billing === "monthly" ? "bg-primary text-primary-foreground font-medium" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Monthly
            </button>
            <button
              onClick={() => setBilling("annual")}
              className={cn(
                "px-4 py-1.5 rounded-full transition-colors flex items-center gap-1.5",
                billing === "annual" ? "bg-primary text-primary-foreground font-medium" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Annual
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Save 26%</Badge>
            </button>
          </div>
        </div>

        {/* Pricing cards */}
        <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {/* Free card */}
          <div className="rounded-xl border border-border bg-card p-6 flex flex-col gap-6">
            <div>
              <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-1">Free</p>
              <h2 className="text-2xl font-bold">LaneBrief Starter</h2>
              <div className="flex items-baseline gap-1 mt-3">
                <span className="text-4xl font-bold">$0</span>
                <span className="text-muted-foreground">/month</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">Forever free — no credit card required</p>
            </div>
            <ul className="space-y-3 flex-1">
              {FREE_FEATURES.map((f) => (
                <li key={f.label} className="flex items-start gap-2.5 text-sm">
                  {f.included ? (
                    <span className="mt-0.5 text-primary">✓</span>
                  ) : (
                    <span className="mt-0.5 text-muted-foreground/40">✕</span>
                  )}
                  <span className={f.included ? "text-foreground" : "text-muted-foreground/60"}>{f.label}</span>
                </li>
              ))}
            </ul>
            <Link href="/sign-up" className={cn(buttonVariants({ variant: "outline" }), "w-full justify-center")}>
              Start free
            </Link>
          </div>

          {/* Pro card */}
          <div className="rounded-xl border-2 border-primary bg-card p-6 flex flex-col gap-6 relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <Badge className="bg-primary text-primary-foreground text-xs px-3 py-0.5">Most popular</Badge>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-widest text-primary mb-1">Pro</p>
              <h2 className="text-2xl font-bold">LaneBrief Pro</h2>
              <div className="flex items-baseline gap-1 mt-3">
                <span className="text-4xl font-bold">
                  {billing === "monthly" ? "$79" : "$58"}
                </span>
                <span className="text-muted-foreground">/month</span>
                {billing === "annual" && (
                  <span className="text-sm text-muted-foreground ml-1">billed $699/yr</span>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {billing === "annual" ? "Save $249/year vs monthly" : "Cancel anytime"}
              </p>
            </div>
            <ul className="space-y-3 flex-1">
              {PRO_FEATURES.map((f) => (
                <li key={f.label} className="flex items-start gap-2.5 text-sm">
                  <span className="mt-0.5 text-primary">✓</span>
                  <span className="text-foreground">{f.label}</span>
                </li>
              ))}
            </ul>
            <Button
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => handleUpgrade(priceId)}
              disabled={loading === priceId}
            >
              {loading === priceId ? "Redirecting..." : "Upgrade to Pro"}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Want to see it first?{" "}
              <Link href="/demo" className="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors">
                Book a 20-min demo →
              </Link>
            </p>
          </div>
        </div>

        {/* FAQ */}
        <div className="max-w-2xl mx-auto space-y-6">
          <h2 className="text-xl font-semibold text-center">Frequently asked questions</h2>
          <div className="space-y-4">
            {FAQS.map((faq) => (
              <div key={faq.q} className="rounded-lg border border-border px-5 py-4">
                <p className="font-medium text-sm">{faq.q}</p>
                <p className="text-sm text-muted-foreground mt-1.5">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="text-center text-sm text-muted-foreground">
          Questions?{" "}
          <a href="mailto:nick@lanebrief.com" className="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors">
            Email nick@lanebrief.com
          </a>
        </div>
      </main>
    </div>
  );
}
