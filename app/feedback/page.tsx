"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

type Phase = "loading" | "invalid" | "form" | "submitting" | "done";

export default function FeedbackPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground text-sm">Loading…</p>
      </main>
    }>
      <FeedbackForm />
    </Suspense>
  );
}

function FeedbackForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [phase, setPhase] = useState<Phase>("loading");
  const [prefillName, setPrefillName] = useState("");
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [text, setText] = useState("");
  const [name, setName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) { setPhase("invalid"); return; }
    fetch(`/api/testimonials/verify?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.valid) {
          setPrefillName(data.name ?? "");
          setName(data.name ?? "");
          setPhase("form");
        } else {
          setPhase("invalid");
        }
      })
      .catch(() => setPhase("invalid"));
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!consent) { setError("Please check the consent box to continue."); return; }
    if (!rating) { setError("Please select a star rating."); return; }
    if (!name.trim()) { setError("Please enter your name."); return; }

    setPhase("submitting");
    setError(null);

    const res = await fetch("/api/testimonials/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, rating, text: text.trim(), name: name.trim(), title: jobTitle.trim(), consent }),
    });

    if (res.ok) {
      setPhase("done");
    } else {
      const data = await res.json().catch(() => ({}));
      setError((data as { error?: string }).error ?? "Something went wrong. Please try again.");
      setPhase("form");
    }
  }

  if (phase === "loading") {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground text-sm">Verifying your link…</p>
      </main>
    );
  }

  if (phase === "invalid") {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center max-w-sm">
          <h1 className="text-xl font-semibold text-foreground mb-2">Link expired or invalid</h1>
          <p className="text-sm text-muted-foreground">This feedback link has expired or already been used. Reply to your LaneBrief email if you'd like to share feedback.</p>
        </div>
      </main>
    );
  }

  if (phase === "done") {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center max-w-sm">
          <div className="text-4xl mb-4">🙏</div>
          <h1 className="text-xl font-semibold text-foreground mb-2">Thank you{prefillName ? `, ${prefillName}` : ""}!</h1>
          <p className="text-sm text-muted-foreground">Your feedback means a lot. It helps us improve LaneBrief for every broker.</p>
          <a href="https://lanebrief.com/dashboard" className="mt-6 inline-block text-sm text-[#00C2A8] hover:underline">Back to dashboard →</a>
        </div>
      </main>
    );
  }

  const stars = [1, 2, 3, 4, 5];
  const displayRating = hovered || rating;

  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <img src="/icon.svg" alt="LaneBrief" className="h-8 mx-auto mb-4" onError={(e) => (e.currentTarget.style.display = "none")} />
          <h1 className="text-xl font-semibold text-foreground">How is LaneBrief working for you?</h1>
          <p className="text-sm text-muted-foreground mt-1">60 seconds. No login needed.</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-card border border-border rounded-xl p-6 space-y-5">
          {/* Star rating */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Your rating <span className="text-red-500">*</span></label>
            <div className="flex gap-1">
              {stars.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setRating(s)}
                  onMouseEnter={() => setHovered(s)}
                  onMouseLeave={() => setHovered(0)}
                  className="text-3xl transition-transform hover:scale-110 focus:outline-none"
                  aria-label={`${s} star${s !== 1 ? "s" : ""}`}
                >
                  <span className={displayRating >= s ? "text-yellow-400" : "text-gray-300"}>★</span>
                </button>
              ))}
            </div>
          </div>

          {/* Open text */}
          <div>
            <label htmlFor="feedback-text" className="block text-sm font-medium text-foreground mb-1">
              What has been most useful about LaneBrief? <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <textarea
              id="feedback-text"
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, 280))}
              rows={3}
              maxLength={280}
              placeholder="The rate forecast on my Chicago–Dallas lane saved me from quoting into a softening market…"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#00C2A8] resize-none"
            />
            <p className="text-xs text-muted-foreground text-right mt-0.5">{text.length}/280</p>
          </div>

          {/* Name */}
          <div>
            <label htmlFor="feedback-name" className="block text-sm font-medium text-foreground mb-1">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              id="feedback-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="James K."
              required
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#00C2A8]"
            />
          </div>

          {/* Title / company */}
          <div>
            <label htmlFor="feedback-title" className="block text-sm font-medium text-foreground mb-1">
              Title / company <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <input
              id="feedback-title"
              type="text"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="Freight Broker, Chicago IL"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#00C2A8]"
            />
          </div>

          {/* Consent */}
          <div className="flex items-start gap-2">
            <input
              id="feedback-consent"
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-border accent-[#00C2A8]"
            />
            <label htmlFor="feedback-consent" className="text-xs text-muted-foreground leading-snug">
              I consent to LaneBrief displaying this feedback on their website. <span className="text-red-500">*</span>
            </label>
          </div>

          {error && (
            <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={phase === "submitting"}
            className="w-full bg-[#00C2A8] hover:bg-[#00a891] disabled:opacity-50 text-white font-semibold text-sm py-2.5 rounded-lg transition-colors"
          >
            {phase === "submitting" ? "Submitting…" : "Submit feedback →"}
          </button>
        </form>
      </div>
    </main>
  );
}
