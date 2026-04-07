"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";

type AffiliateStats = {
  signups: number;
  conversions: number;
  pendingEarnings: number;
  paidEarnings: number;
};

type Earning = {
  id: string;
  invoiceId: string;
  amountUsd: number;
  paidOut: boolean;
  createdAt: string;
};

type Payout = {
  id: string;
  amountUsd: number;
  method: string;
  paidAt: string;
};

type AffiliateData = {
  affiliate: {
    id: string;
    name: string;
    email: string;
    code: string;
    status: string;
    pendingEarnings: number;
    paidEarnings: number;
  } | null;
  stats: AffiliateStats;
  earnings: Earning[];
  payouts: Payout[];
};

const ASSETS_ZIP_URL = "https://lanebrief.com/affiliates/assets.zip";
const BASE_URL = "https://lanebrief.com";

export default function AffiliateDashboard() {
  const { user, isLoaded } = useUser();
  const [data, setData] = useState<AffiliateData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isLoaded || !user) return;
    fetch("/api/affiliates/me")
      .then((r) => r.json())
      .then((d) => setData(d))
      .finally(() => setLoading(false));
  }, [isLoaded, user]);

  const copyLink = (link: string) => {
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isLoaded || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-400 text-sm">Loading…</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-600 mb-4 text-sm">Sign in to access your affiliate dashboard.</p>
          <Link href="/sign-in" className="px-4 py-2 bg-[#0D1F3C] text-white rounded text-sm hover:bg-[#162d57]">
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  if (!data?.affiliate) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">No affiliate account found</h2>
          <p className="text-sm text-gray-500 mb-4">
            Your account email isn&apos;t linked to an approved affiliate application.
          </p>
          <Link href="/affiliates#apply" className="px-4 py-2 bg-[#0D1F3C] text-white rounded text-sm hover:bg-[#162d57]">
            Apply to become an affiliate
          </Link>
        </div>
      </div>
    );
  }

  const { affiliate, stats, earnings, payouts } = data;

  if (affiliate.status === "pending") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-sm">
          <div className="text-4xl mb-3">⏳</div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Application under review</h2>
          <p className="text-sm text-gray-500">Nick reviews every application personally and usually responds within 48 hours.</p>
        </div>
      </div>
    );
  }

  if (affiliate.status === "rejected") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Application not approved</h2>
          <p className="text-sm text-gray-500 mb-4">
            If you think this is a mistake, reply to the email you received from nick@lanebrief.com.
          </p>
        </div>
      </div>
    );
  }

  const referralLink = `${BASE_URL}/?ref=${affiliate.code}`;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-10 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-xl font-bold text-gray-900">Affiliate Dashboard</h1>
          <p className="text-sm text-gray-400">Welcome back, {affiliate.name}</p>
        </div>

        {/* Referral link */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Your referral link</div>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-gray-50 border border-gray-200 rounded px-3 py-2 text-sm text-gray-700 truncate">
              {referralLink}
            </code>
            <button
              onClick={() => copyLink(referralLink)}
              className="px-4 py-2 bg-[#0D1F3C] text-white text-sm rounded hover:bg-[#162d57] transition-colors whitespace-nowrap"
            >
              {copied ? "Copied!" : "Copy link"}
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-2">Share this link. Anyone who signs up within 90 days is attributed to you.</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Signups", value: stats.signups },
            { label: "Conversions (Pro)", value: stats.conversions },
            { label: "Pending earnings", value: `$${stats.pendingEarnings.toFixed(2)}` },
            { label: "Total paid out", value: `$${stats.paidEarnings.toFixed(2)}` },
          ].map(({ label, value }) => (
            <div key={label} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">{label}</div>
              <div className="text-2xl font-bold text-gray-900">{value}</div>
            </div>
          ))}
        </div>

        {/* Marketing assets */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Marketing assets</div>
          <div className="grid md:grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
              <div className="text-sm font-medium text-gray-700 mb-1">Email template</div>
              <pre className="text-xs text-gray-500 whitespace-pre-wrap leading-relaxed">{`Subject: Earn money recommending LaneBrief

Hey {{first_name}},

I've been using LaneBrief for lane rate intelligence and it's been worth it.

They just launched an affiliate program — if you refer a freight broker who subscribes, you earn 20% recurring for 12 months.

Check it out: ${referralLink}

— [Your name]`}</pre>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-100 flex flex-col gap-2">
              <div className="text-sm font-medium text-gray-700 mb-1">Downloads</div>
              <a
                href={ASSETS_ZIP_URL}
                className="text-sm text-[#00C2A8] hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                LaneBrief logos + screenshots (ZIP)
              </a>
              <p className="text-xs text-gray-400">Use in newsletters, LinkedIn posts, or group posts.</p>
            </div>
          </div>
        </div>

        {/* Earnings history */}
        {earnings.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Earnings history
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-400 uppercase tracking-wide">
                  <th className="px-4 py-2 text-left">Date</th>
                  <th className="px-4 py-2 text-left">Amount</th>
                  <th className="px-4 py-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {earnings.map((e) => (
                  <tr key={e.id} className="border-b border-gray-50">
                    <td className="px-4 py-2.5 text-gray-500 text-xs">
                      {new Date(e.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2.5 font-medium text-gray-800">${e.amountUsd.toFixed(2)}</td>
                    <td className="px-4 py-2.5">
                      {e.paidOut ? (
                        <span className="px-2 py-0.5 rounded text-xs bg-green-100 text-green-700">Paid</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-xs bg-yellow-100 text-yellow-700">Pending</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Payout history */}
        {payouts.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Payout history
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-400 uppercase tracking-wide">
                  <th className="px-4 py-2 text-left">Date</th>
                  <th className="px-4 py-2 text-left">Amount</th>
                  <th className="px-4 py-2 text-left">Method</th>
                </tr>
              </thead>
              <tbody>
                {payouts.map((p) => (
                  <tr key={p.id} className="border-b border-gray-50">
                    <td className="px-4 py-2.5 text-gray-500 text-xs">
                      {new Date(p.paidAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2.5 font-medium text-gray-800">${p.amountUsd.toFixed(2)}</td>
                    <td className="px-4 py-2.5 text-gray-500 text-xs capitalize">{p.method}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="text-xs text-gray-400 text-center">
          Questions? Email <a href="mailto:nick@lanebrief.com" className="underline">nick@lanebrief.com</a>
        </div>
      </div>
    </div>
  );
}
