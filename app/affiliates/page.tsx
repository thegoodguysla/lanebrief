"use client";

import { useState } from "react";
import Link from "next/link";

export default function AffiliatesPage() {
  const [form, setForm] = useState({ name: "", email: "", audience: "", howToPromote: "" });
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");
    try {
      const res = await fetch("/api/affiliates/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error ?? "Something went wrong");
        setStatus("error");
      } else {
        setStatus("success");
      }
    } catch {
      setErrorMsg("Network error — please try again");
      setStatus("error");
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <div className="bg-[#0D1F3C] text-white py-20 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-block bg-[#00C2A8]/20 text-[#00C2A8] text-xs font-semibold px-3 py-1 rounded-full mb-4 uppercase tracking-wide">
            Affiliate Program
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 leading-tight">
            Earn 20% recurring commission recommending LaneBrief
          </h1>
          <p className="text-lg text-gray-300 mb-8 max-w-xl mx-auto">
            Know freight brokers? Refer them to LaneBrief and earn $15.80 every month for a full year — per customer.
          </p>
          <div className="flex flex-wrap justify-center gap-6 text-sm text-gray-300">
            <div className="flex items-center gap-2">
              <span className="text-[#00C2A8] font-bold text-lg">20%</span>
              <span>recurring commission</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[#00C2A8] font-bold text-lg">12mo</span>
              <span>per referred customer</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[#00C2A8] font-bold text-lg">90d</span>
              <span>cookie window</span>
            </div>
          </div>
        </div>
      </div>

      {/* How it works */}
      <div className="py-16 px-6 bg-gray-50">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">How it works</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { step: "1", title: "Apply below", desc: "Tell us about your audience. We review every application personally." },
              { step: "2", title: "Get your link", desc: "Once approved, you'll get a unique referral link to share." },
              { step: "3", title: "Get paid", desc: "Earn 20% of every payment from customers you refer, for 12 months." },
            ].map(({ step, title, desc }) => (
              <div key={step} className="bg-white rounded-xl p-6 border border-gray-200">
                <div className="w-8 h-8 bg-[#0D1F3C] text-white rounded-full flex items-center justify-center text-sm font-bold mb-3">
                  {step}
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">{title}</h3>
                <p className="text-sm text-gray-500">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Earnings example */}
      <div className="py-16 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">The math is simple</h2>
          <p className="text-gray-500 mb-8">Pro plan is $79/month. You earn $15.80/month per referred customer, for 12 months.</p>
          <div className="grid grid-cols-3 gap-4">
            {[
              { referrals: 1, monthly: "$15.80", annual: "$189.60" },
              { referrals: 5, monthly: "$79", annual: "$948" },
              { referrals: 10, monthly: "$158", annual: "$1,896" },
            ].map(({ referrals, monthly, annual }) => (
              <div key={referrals} className="bg-gray-50 rounded-xl p-5 border border-gray-200">
                <div className="text-3xl font-bold text-[#0D1F3C] mb-1">{referrals}</div>
                <div className="text-xs text-gray-400 mb-3">referral{referrals > 1 ? "s" : ""}</div>
                <div className="text-lg font-semibold text-[#00C2A8]">{monthly}/mo</div>
                <div className="text-xs text-gray-400">{annual}/yr</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Apply form */}
      <div className="py-16 px-6 bg-gray-50" id="apply">
        <div className="max-w-lg mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">Apply to become an affiliate</h2>
          <p className="text-sm text-gray-500 text-center mb-8">Nick reviews every application personally. Usually responds within 48 hours.</p>

          {status === "success" ? (
            <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
              <div className="text-2xl mb-2">🎉</div>
              <h3 className="font-semibold text-green-800 mb-1">Application received!</h3>
              <p className="text-sm text-green-700">Nick will review your application and reach out within 48 hours.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Your name *</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00C2A8]"
                  placeholder="Jane Smith"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email address *</label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00C2A8]"
                  placeholder="jane@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Your audience</label>
                <input
                  type="text"
                  value={form.audience}
                  onChange={(e) => setForm((f) => ({ ...f, audience: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00C2A8]"
                  placeholder="e.g. 2,000 freight brokers in my Facebook group"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">How you plan to promote LaneBrief</label>
                <textarea
                  value={form.howToPromote}
                  onChange={(e) => setForm((f) => ({ ...f, howToPromote: e.target.value }))}
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00C2A8] resize-none"
                  placeholder="Newsletter, Facebook group, LinkedIn posts..."
                />
              </div>
              {status === "error" && (
                <p className="text-sm text-red-600">{errorMsg}</p>
              )}
              <button
                type="submit"
                disabled={status === "loading"}
                className="w-full bg-[#0D1F3C] text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-[#162d57] disabled:opacity-50 transition-colors"
              >
                {status === "loading" ? "Submitting…" : "Apply to become an affiliate"}
              </button>
            </form>
          )}

          <p className="text-xs text-gray-400 text-center mt-4">
            Already approved?{" "}
            <Link href="/affiliates/dashboard" className="text-[#00C2A8] hover:underline">
              Go to your dashboard →
            </Link>
          </p>
        </div>
      </div>

      {/* FAQ */}
      <div className="py-16 px-6">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">FAQ</h2>
          <div className="space-y-4">
            {[
              { q: "When do I get paid?", a: "Payouts are processed monthly once you hit $50 in pending earnings. Nick initiates the transfer via Stripe or PayPal." },
              { q: "How long does the cookie last?", a: "90 days. If someone clicks your link and signs up within 90 days, you get credit." },
              { q: "Can I be an affiliate if I'm a LaneBrief customer?", a: "Yes. You can refer other brokers and earn commission on top of your own subscription." },
              { q: "What if someone cancels?", a: "Commission is only paid on successful payments. Cancellations stop future commission for that customer." },
              { q: "Is there a limit to how much I can earn?", a: "No limit. Refer 100 brokers, earn $1,580/month." },
            ].map(({ q, a }) => (
              <div key={q} className="border border-gray-200 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 text-sm mb-1">{q}</h3>
                <p className="text-sm text-gray-500">{a}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
