"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

// When Nick sets up Cal.com, set NEXT_PUBLIC_CAL_USERNAME (e.g. "nick-lanebrief")
// and NEXT_PUBLIC_CAL_EVENT_SLUG (e.g. "lanebrief-demo") in Vercel env vars.
// The Cal.com embed will automatically activate.
const CAL_USERNAME = process.env.NEXT_PUBLIC_CAL_USERNAME ?? "";
const CAL_EVENT_SLUG = process.env.NEXT_PUBLIC_CAL_EVENT_SLUG ?? "lanebrief-demo";

export default function DemoPage() {
  const calEmbedUrl = CAL_USERNAME
    ? `https://cal.com/${CAL_USERNAME}/${CAL_EVENT_SLUG}?embed=true&layout=month_view`
    : null;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Nav */}
      <nav className="border-b border-border/60 bg-background/95 backdrop-blur sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg">
            <span className="text-primary">▶</span> LaneBrief
          </Link>
          <Link href="/sign-up" className={cn(buttonVariants({ size: "sm" }))}>
            Start free
          </Link>
        </div>
      </nav>

      <main className="flex-1 flex flex-col items-center px-4 py-12">
        <div className="max-w-3xl w-full mx-auto space-y-8">

          {/* Header */}
          <div className="text-center space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              20-Minute Demo — No Commitment
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
              See LaneBrief in action —{" "}
              <span className="text-primary">live demo with Nick</span>
            </h1>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              20 minutes. Your lanes. Real data. No slides.
            </p>
          </div>

          {/* What to expect */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-center">
            {[
              { icon: "📊", label: "Your top lanes — live" },
              { icon: "💰", label: "Real rates & forecasts" },
              { icon: "⚠️", label: "Carrier risk scores" },
              { icon: "🧮", label: "Honest ROI math" },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-xl border border-border bg-muted/30 px-4 py-4"
              >
                <div className="text-xl mb-1">{item.icon}</div>
                <p className="text-sm font-medium">{item.label}</p>
              </div>
            ))}
          </div>

          {/* Booking area */}
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            {calEmbedUrl ? (
              <iframe
                src={calEmbedUrl}
                title="Book a LaneBrief Demo"
                className="w-full"
                style={{ height: "700px", border: "none" }}
                loading="lazy"
              />
            ) : (
              /* Fallback: mailto link until Cal.com is configured */
              <div className="p-10 text-center space-y-5">
                <div className="text-4xl">📅</div>
                <h2 className="text-xl font-bold">Book a time with Nick</h2>
                <p className="text-muted-foreground text-sm max-w-sm mx-auto">
                  Online scheduling is coming shortly. In the meantime, email Nick directly
                  and he&apos;ll reply with two or three times that work.
                </p>
                <a
                  href="mailto:nick@lanebrief.com?subject=LaneBrief%20Demo%20Request&body=Hi%20Nick%2C%0A%0AI%27d%20love%20to%20see%20LaneBrief%20in%20action.%20Here%20are%20my%20top%20lanes%3A%0A%0A1.%20%0A2.%20%0A3.%20%0A%0APlease%20suggest%20a%2020-minute%20time%20that%20works."
                  className={cn(
                    buttonVariants({ size: "lg" }),
                    "bg-primary text-primary-foreground hover:bg-primary/90 text-base"
                  )}
                >
                  Email nick@lanebrief.com →
                </a>
                <p className="text-xs text-muted-foreground">
                  Nick typically responds within a few hours during business days.
                </p>
              </div>
            )}
          </div>

          {/* Not ready CTA */}
          <p className="text-center text-sm text-muted-foreground">
            Not ready to book?{" "}
            <Link
              href="/sign-up"
              className="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors font-medium"
            >
              Start free — no card required
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
