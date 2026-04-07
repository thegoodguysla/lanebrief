"use client";

import { useEffect, useState, useCallback } from "react";
import { useUser, SignInButton } from "@clerk/nextjs";

const ADMIN_EMAILS = ["nick@lanebrief.com", "nick@thegoodguys.la"];

type Metric = {
  mrr: number;
  activePro: number;
  activeFree: number;
  activeTrials: number;
  conversionRate30d: number;
  signupsToday: number;
  signupsThisWeek: number;
  signupsThisMonth: number;
  demoBookings: number;
  reportSharesTotal: number;
  reportSharesConverted: number;
};

type FeatureUsage = { feature: string; count: number };
type SignupDay = { date: string; count: number };
type UserRow = {
  id: string;
  email: string;
  plan: string;
  subscriptionStatus: string | null;
  lanesCount: number;
  trialEndsAt: string | null;
  createdAt: string;
};

type DashboardData = {
  metrics: Metric;
  featureUsage: FeatureUsage[];
  signupsByDay: SignupDay[];
  users: UserRow[];
};

function MetricCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">{label}</div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </div>
  );
}

function BarChart({ data, valueKey, labelKey }: { data: SignupDay[]; valueKey: "count"; labelKey: "date" }) {
  if (!data.length) return <div className="text-sm text-gray-400 py-4">No data</div>;
  const max = Math.max(...data.map((d) => d[valueKey]), 1);
  // Show last 30 points, spaced out
  const visible = data.slice(-30);
  return (
    <div className="flex items-end gap-0.5 h-24 w-full">
      {visible.map((d) => (
        <div
          key={d[labelKey]}
          className="flex-1 bg-blue-500 rounded-t opacity-80 hover:opacity-100 transition-opacity min-w-0"
          style={{ height: `${Math.max(4, Math.round((d[valueKey] / max) * 96))}%` }}
          title={`${d[labelKey]}: ${d[valueKey]}`}
        />
      ))}
    </div>
  );
}

function HBarChart({ data }: { data: FeatureUsage[] }) {
  if (!data.length) return null;
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="space-y-2">
      {data.map((d) => (
        <div key={d.feature} className="flex items-center gap-2">
          <div className="w-32 text-xs text-gray-600 text-right flex-shrink-0">{d.feature}</div>
          <div className="flex-1 bg-gray-100 rounded h-5 overflow-hidden">
            <div
              className="h-full bg-indigo-500 rounded"
              style={{ width: `${Math.max(4, Math.round((d.count / max) * 100))}%` }}
            />
          </div>
          <div className="w-10 text-xs text-gray-600 text-right flex-shrink-0">{d.count}</div>
        </div>
      ))}
    </div>
  );
}

function planBadge(plan: string, status: string | null, trialEndsAt: string | null) {
  const now = new Date();
  if (trialEndsAt && new Date(trialEndsAt) > now) {
    const daysLeft = Math.ceil((new Date(trialEndsAt).getTime() - now.getTime()) / 86400000);
    return <span className="px-2 py-0.5 rounded text-xs bg-yellow-100 text-yellow-800">Trial ({daysLeft}d)</span>;
  }
  if (plan === "pro" && (status === "active" || status === "trialing")) {
    return <span className="px-2 py-0.5 rounded text-xs bg-green-100 text-green-800">Pro</span>;
  }
  return <span className="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600">Free</span>;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const d = Math.floor(diff / 86400000);
  if (d === 0) return "today";
  if (d === 1) return "1d ago";
  if (d < 30) return `${d}d ago`;
  const m = Math.floor(d / 30);
  return `${m}mo ago`;
}

export default function AdminPage() {
  const { user, isLoaded } = useUser();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sortField, setSortField] = useState<keyof UserRow>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [extendingId, setExtendingId] = useState<string | null>(null);

  const isAdmin = isLoaded && !!user && ADMIN_EMAILS.includes(user.primaryEmailAddress?.emailAddress ?? "");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/revenue");
      if (res.status === 403) {
        setError("forbidden");
        return;
      }
      if (!res.ok) throw new Error("Failed to load data");
      setData(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) fetchData();
  }, [isAdmin, fetchData]);

  const handleExtendTrial = async (userId: string) => {
    setExtendingId(userId);
    try {
      const res = await fetch("/api/admin/extend-trial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) throw new Error("Failed");
      await fetchData();
    } catch {
      alert("Failed to extend trial");
    } finally {
      setExtendingId(null);
    }
  };

  const toggleSort = (field: keyof UserRow) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const sortedUsers = data
    ? [...data.users].sort((a, b) => {
        const av = a[sortField];
        const bv = b[sortField];
        const cmp = String(av ?? "").localeCompare(String(bv ?? ""), undefined, { numeric: true });
        return sortDir === "asc" ? cmp : -cmp;
      })
    : [];

  if (!isLoaded) {
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
          <p className="text-gray-600 mb-4">Sign in to access the admin dashboard.</p>
          <SignInButton mode="modal">
            <button className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm">Sign In</button>
          </SignInButton>
        </div>
      </div>
    );
  }

  if (!isAdmin || error === "forbidden") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-6xl font-bold text-gray-200 mb-2">403</div>
          <p className="text-gray-500 text-sm">Access denied.</p>
        </div>
      </div>
    );
  }

  if (loading && !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-400 text-sm">Loading dashboard…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-red-500 text-sm mb-3">{error}</p>
          <button onClick={fetchData} className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { metrics, featureUsage, signupsByDay } = data;

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">LaneBrief Admin</h1>
            <p className="text-xs text-gray-400">Revenue Dashboard</p>
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="px-3 py-1.5 text-xs bg-white border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-50"
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCard label="MRR" value={`$${metrics.mrr.toLocaleString()}`} />
          <MetricCard label="Active Pro" value={metrics.activePro} />
          <MetricCard label="Active Trials" value={metrics.activeTrials} />
          <MetricCard label="Free Users" value={metrics.activeFree} />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCard
            label="Trial → Paid (30d)"
            value={`${metrics.conversionRate30d}%`}
          />
          <MetricCard
            label="Signups"
            value={metrics.signupsThisMonth}
            sub={`${metrics.signupsThisWeek} this week · ${metrics.signupsToday} today`}
          />
          <MetricCard label="Demo Bookings" value={metrics.demoBookings} />
          <MetricCard
            label="Report Shares"
            value={metrics.reportSharesTotal}
            sub={`${metrics.reportSharesConverted} converted`}
          />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="text-xs font-semibold text-gray-600 mb-3 uppercase tracking-wide">
              Signups — Last 30 Days
            </div>
            <BarChart data={signupsByDay} valueKey="count" labelKey="date" />
            <div className="flex justify-between text-xs text-gray-300 mt-1">
              <span>{signupsByDay[0]?.date ?? ""}</span>
              <span>{signupsByDay[signupsByDay.length - 1]?.date ?? ""}</span>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="text-xs font-semibold text-gray-600 mb-3 uppercase tracking-wide">
              Feature Usage (all-time)
            </div>
            <HBarChart data={featureUsage} />
          </div>
        </div>

        {/* Cold Email Stats — static placeholder */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-xs font-semibold text-gray-600 mb-3 uppercase tracking-wide">Cold Email Stats</div>
          <p className="text-xs text-gray-400">
            Connect Instantly webhook to populate this section automatically, or update manually below.
          </p>
          <div className="grid grid-cols-3 gap-3 mt-3">
            <div className="text-center">
              <div className="text-lg font-bold text-gray-700">—</div>
              <div className="text-xs text-gray-400">Emails Sent</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-gray-700">—</div>
              <div className="text-xs text-gray-400">Reply Rate</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-gray-700">—</div>
              <div className="text-xs text-gray-400">Converted to Signup</div>
            </div>
          </div>
        </div>

        {/* User Table */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
              Users ({data.users.length})
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-400 uppercase tracking-wide">
                  {(
                    [
                      ["email", "Email"],
                      ["plan", "Plan"],
                      ["lanesCount", "Lanes"],
                      ["createdAt", "Signed Up"],
                    ] as [keyof UserRow, string][]
                  ).map(([field, label]) => (
                    <th
                      key={field}
                      className="px-4 py-2 text-left cursor-pointer hover:text-gray-600 select-none"
                      onClick={() => toggleSort(field)}
                    >
                      {label}
                      {sortField === field ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
                    </th>
                  ))}
                  <th className="px-4 py-2 text-left text-xs text-gray-400 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedUsers.map((u) => (
                  <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-2.5 font-mono text-xs text-gray-700">{u.email}</td>
                    <td className="px-4 py-2.5">{planBadge(u.plan, u.subscriptionStatus, u.trialEndsAt)}</td>
                    <td className="px-4 py-2.5 text-gray-600">{u.lanesCount}</td>
                    <td className="px-4 py-2.5 text-gray-400 text-xs">{timeAgo(u.createdAt)}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <a
                          href={`mailto:${u.email}`}
                          className="text-xs text-blue-500 hover:text-blue-700 underline"
                        >
                          Email
                        </a>
                        <button
                          onClick={() => handleExtendTrial(u.id)}
                          disabled={extendingId === u.id}
                          className="text-xs text-indigo-500 hover:text-indigo-700 disabled:opacity-40"
                        >
                          {extendingId === u.id ? "Extending…" : "+7d Trial"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {sortedUsers.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-300">
                      No users yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
