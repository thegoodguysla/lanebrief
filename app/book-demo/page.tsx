"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { sendGAEvent } from "@next/third-parties/google";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const DEMO_BOOKING_URL = "https://calendar.app.google/d5reMPsxnBWAguRC6";

function BookDemoContent() {
  const searchParams = useSearchParams();
  const utmSource = searchParams.get("utm_source") || "";
  const utmCampaign = searchParams.get("utm_campaign") || "";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fire a page-view GA event with source context
  useEffect(() => {
    if (utmSource) {
      sendGAEvent("event", "demo_page_view", {
        utm_source: utmSource,
        utm_campaign: utmCampaign,
      });
    }
  }, [utmSource, utmCampaign]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      sendGAEvent("event", "demo_booking_intent", {
        utm_source: utmSource || "direct",
        utm_campaign: utmCampaign,
      });

      await fetch("/api/book-demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, utmSource, utmCampaign }),
      });

      setSubmitted(true);

      // Redirect to the scheduling link after a brief delay
      setTimeout(() => {
        window.open(DEMO_BOOKING_URL, "_blank");
      }, 800);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#0D1F3C] text-white flex flex-col">
      {/* Header */}
      <header className="border-b border-white/10 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center gap-2">
          <span className="text-[#00C2A8] font-bold text-lg">&#9658;</span>
          <span className="font-bold text-white text-lg">LaneBrief</span>
          <span className="text-white/40 text-sm ml-1">AI-Powered Freight Intelligence</span>
        </div>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-16">
        <div className="max-w-2xl w-full mx-auto">

          {/* Badge */}
          <div className="flex justify-center mb-6">
            <span
              className="inline-block bg-[#00C2A8]/10 border border-[#00C2A8]/30 text-[#00C2A8] text-xs font-semibold px-4 py-1.5 rounded-full tracking-wide uppercase"
            >
              30-Minute Demo — No Commitment
            </span>
          </div>

          {/* Headline */}
          <h1 className="text-3xl sm:text-4xl font-bold text-center text-white leading-tight mb-4">
            See how LaneBrief gives you<br />
            <span className="text-[#00C2A8]">lane-level intelligence</span> in minutes
          </h1>
          <p className="text-center text-white/60 text-base mb-10 max-w-lg mx-auto">
            In 30 minutes, you&apos;ll see a live intelligence brief on lanes you actually run —
            spot trends, capacity signals, and rate forecasts. No slides, no sales pitch.
          </p>

          {/* What you'll see */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
            {[
              { icon: "📊", title: "Live lane data", desc: "Real rate trends on corridors you care about" },
              { icon: "⚡", title: "5-min setup", desc: "Your first brief generated during the call" },
              { icon: "💡", title: "Honest ROI math", desc: "We&apos;ll tell you if it&apos;s not worth it" },
            ].map((item) => (
              <div
                key={item.title}
                className="bg-white/5 border border-white/10 rounded-xl p-4 text-center"
              >
                <div className="text-2xl mb-2">{item.icon}</div>
                <div className="font-semibold text-white text-sm mb-1">{item.title}</div>
                <div
                  className="text-white/50 text-xs"
                  dangerouslySetInnerHTML={{ __html: item.desc }}
                />
              </div>
            ))}
          </div>

          {/* Booking Form */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
            {submitted ? (
              <div className="text-center py-4">
                <div className="text-3xl mb-4">✅</div>
                <h2 className="text-xl font-bold text-white mb-2">You&apos;re all set!</h2>
                <p className="text-white/60 text-sm mb-4">
                  A prep email is on its way to <strong>{email}</strong>.<br />
                  The scheduling calendar is opening now — pick a time that works.
                </p>
                <a
                  href={DEMO_BOOKING_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block bg-[#00C2A8] hover:bg-[#00A896] text-white font-semibold py-3 px-8 rounded-lg transition-colors"
                >
                  Open Scheduling Calendar →
                </a>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-white/70 text-sm mb-1.5" htmlFor="name">
                    Your name
                  </label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="Jane Smith"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/30 focus:border-[#00C2A8] focus:ring-[#00C2A8]"
                  />
                </div>
                <div>
                  <label className="block text-white/70 text-sm mb-1.5" htmlFor="email">
                    Work email
                  </label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="jane@brokerage.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/30 focus:border-[#00C2A8] focus:ring-[#00C2A8]"
                  />
                </div>

                {error && (
                  <p className="text-red-400 text-sm">{error}</p>
                )}

                <Button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-[#00C2A8] hover:bg-[#00A896] text-white font-semibold py-3 text-base rounded-lg transition-colors"
                >
                  {submitting ? "One moment…" : "Pick a time that works →"}
                </Button>

                <p className="text-center text-white/30 text-xs">
                  We&apos;ll send you a 1-page prep note before the call. No spam.
                </p>
              </form>
            )}
          </div>

          {/* Social proof */}
          <p className="text-center text-white/30 text-xs mt-8">
            Nick Taylor · Founder, LaneBrief · nick@lanebrief.com
          </p>
        </div>
      </div>
    </main>
  );
}

export default function BookDemoPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0D1F3C]" />}>
      <BookDemoContent />
    </Suspense>
  );
}
