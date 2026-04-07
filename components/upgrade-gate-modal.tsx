"use client";

import { useEffect, useRef, useState } from "react";
import { track } from "@vercel/analytics/react";
import { Button } from "@/components/ui/button";
import { trackEvent } from "@/lib/analytics";

export type GateContext = "lane_limit" | "forecast" | "carrier_risk";

// A/B variants for primary CTA copy — assigned once per browser, persisted in localStorage
const AB_VARIANTS = ["upgrade", "keep", "unlock"] as const;
type AbVariant = (typeof AB_VARIANTS)[number];

function getAbVariant(): AbVariant {
  if (typeof window === "undefined") return "upgrade";
  const stored = localStorage.getItem("gate_cta_variant") as AbVariant | null;
  if (stored && AB_VARIANTS.includes(stored)) return stored;
  const assigned = AB_VARIANTS[Math.floor(Math.random() * AB_VARIANTS.length)];
  localStorage.setItem("gate_cta_variant", assigned);
  return assigned;
}

const COPY: Record<
  GateContext,
  { heading: string; body: string; cta: Record<AbVariant, string>; annualCta: string }
> = {
  lane_limit: {
    heading: "You have 3 lanes — the free limit",
    body: "Upgrade to Pro for unlimited lanes, 7-day rate forecasts, and carrier risk scores on every lane.",
    cta: {
      upgrade: "Upgrade to Pro — $79/mo",
      keep: "Keep all your lanes — $79/mo",
      unlock: "Unlock unlimited lanes — $79/mo",
    },
    annualCta: "Annual: $699/yr — saves $249",
  },
  forecast: {
    heading: "See where rates are heading",
    body: "7-day rate forecasts show you whether to lock in capacity now or wait. Unlock before your competition does.",
    cta: {
      upgrade: "Upgrade to Pro — $79/mo",
      keep: "Keep seeing forecasts — $79/mo",
      unlock: "Unlock forecasts — $79/mo",
    },
    annualCta: "Annual: $699/yr — saves $249",
  },
  carrier_risk: {
    heading: "You've used your 5 free risk scores today",
    body: "Pro gives you unlimited carrier risk scores — know which carriers are double-brokering risks before you tender.",
    cta: {
      upgrade: "Upgrade to Pro — $79/mo",
      keep: "Keep getting risk scores — $79/mo",
      unlock: "Get unlimited scores — $79/mo",
    },
    annualCta: "Annual: $699/yr — saves $249",
  },
};

interface UpgradeGateModalProps {
  context: GateContext;
  onDismiss: () => void;
}

export function UpgradeGateModal({ context, onDismiss }: UpgradeGateModalProps) {
  const [loading, setLoading] = useState(false);
  const [variant, setVariant] = useState<AbVariant>("upgrade");
  const firedShown = useRef(false);

  useEffect(() => {
    setVariant(getAbVariant());
    if (!firedShown.current) {
      firedShown.current = true;
      track("gate_shown", { gate: context, variant });
      trackEvent("paywall_gate_shown", { gate: context, variant });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context]);

  async function handleCheckout(annual: boolean) {
    const plan = annual ? "annual" : "monthly";
    track("gate_converted", { gate: context, variant, plan });
    trackEvent("upgrade_clicked", { gate: context, variant, plan });
    trackEvent("paywall_gate_converted", { gate: context, variant, plan });
    setLoading(true);
    try {
      const { STRIPE_PRICES } = await import("@/lib/stripe");
      const priceId = annual ? STRIPE_PRICES.proAnnual : STRIPE_PRICES.proMonthly;
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId }),
      });
      const data = await res.json();
      if (data.url) {
        trackEvent("checkout_started", { gate: context, plan });
        window.location.href = data.url;
      }
    } finally {
      setLoading(false);
    }
  }

  function handleDismiss() {
    track("gate_dismissed", { gate: context, variant });
    onDismiss();
  }

  const copy = COPY[context];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-background border border-border rounded-xl shadow-xl max-w-sm w-full p-6 space-y-4">
        <div className="space-y-1">
          <h2 className="font-semibold text-lg">{copy.heading}</h2>
          <p className="text-sm text-muted-foreground">{copy.body}</p>
        </div>
        <div className="rounded-lg bg-primary/5 border border-primary/20 px-4 py-3 text-sm space-y-1">
          <div className="font-semibold text-primary">LaneBrief Pro</div>
          <ul className="text-muted-foreground space-y-0.5 text-xs">
            <li>✓ Unlimited lanes</li>
            <li>✓ 7-day rate forecasts on all lanes</li>
            <li>✓ Unlimited carrier risk scores</li>
            <li>✓ Rate alerts + tariff flags</li>
          </ul>
        </div>
        <div className="space-y-2">
          <Button
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => handleCheckout(false)}
            disabled={loading}
          >
            {loading ? "Redirecting…" : copy.cta[variant]}
          </Button>
          <button
            className="w-full text-xs text-muted-foreground hover:text-foreground text-center"
            onClick={() => handleCheckout(true)}
            disabled={loading}
          >
            {copy.annualCta}
          </button>
        </div>
        <button
          className="w-full text-xs text-muted-foreground hover:text-foreground text-center"
          onClick={handleDismiss}
        >
          Maybe later
        </button>
      </div>
    </div>
  );
}
