"use client";

import { useEffect, useState, useCallback } from "react";
import { useUser, SignInButton } from "@clerk/nextjs";
import { TestimonialCard } from "@/components/testimonial-card";

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

type TestimonialRow = {
  id: string;
  rating: number;
  text: string | null;
  name: string;
  title: string | null;
  approved: boolean;
  createdAt: string;
};

type ProspectStage = "replied" | "demo_booked" | "trial_active" | "paid" | "churned";

type Prospect = {
  id: string;
  name: string;
  email: string;
  company: string | null;
  stage: ProspectStage;
  replySnippet: string | null;
  notes: string | null;
  createdAt: string;
};

const STAGES: { key: ProspectStage; label: string }[] = [
  { key: "replied", label: "Replied" },
  { key: "demo_booked", label: "Demo Booked" },
  { key: "trial_active", label: "Trial Active" },
  { key: "paid", label: "Paid" },
  { key: "churned", label: "Churned" },
];

const TEMPLATES = [
  {
    title: "Thanks for replying — here's a quick demo",
    body: `Hey [name],

Great to hear from you. Happy to give you a quick walk-through — we can look at your specific lanes live.

[Book a 20-min slot here: lanebrief.com/demo]

Or if you want to just dive in: lanebrief.com/signup — free trial, no card required.

— Nick`,
  },
  {
    title: '"Not interested" graceful exit',
    body: `Totally understand — no worries at all.

If you ever run US-MX or cross-border lanes and want intel on tariff exposure, feel free to check back.

— Nick`,
  },
  {
    title: '"Send me more info"',
    body: `Happy to. LaneBrief tracks real-time spot rates, 7-day forecasts, and carrier risk scores — all for your specific lanes, updated daily.

Quickest way to see it: lanebrief.com/sample-report — enter your top lanes and get a free report in 60 seconds.

Or we can do a live walk-through: lanebrief.com/demo

— Nick`,
  },
  {
    title: '"What does it cost?"',
    body: `Free to try — no card required.

Pro plan is $79/month (unlimited lanes, forecasts, carrier risk scores, weekly reports). Annual is $699 — saves you $249.

Start free here and upgrade if it is useful: lanebrief.com/signup

— Nick`,
  },
  {
    title: "Follow-up if no reply in 3 days",
    body: `Hey [name], just following up on my last email.

Worth 20 minutes to see LaneBrief on your lanes? lanebrief.com/demo

— Nick`,
  },
];

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

function stageBadge(stage: ProspectStage) {
  const map: Record<ProspectStage, string> = {
    replied: "bg-blue-100 text-blue-800",
    demo_booked: "bg-purple-100 text-purple-800",
    trial_active: "bg-yellow-100 text-yellow-800",
    paid: "bg-green-100 text-green-800",
    churned: "bg-gray-100 text-gray-500",
  };
  const label = STAGES.find((s) => s.key === stage)?.label ?? stage;
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${map[stage]}`}>{label}</span>;
}

function PipelineTab() {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [form, setForm] = useState({ name: "", email: "", company: "", stage: "replied" as ProspectStage, replySnippet: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);

  const fetchProspects = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/prospects");
      if (res.ok) {
        const json = await res.json();
        setProspects(json.prospects ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProspects(); }, [fetchProspects]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await fetch("/api/admin/prospects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setForm({ name: "", email: "", company: "", stage: "replied", replySnippet: "", notes: "" });
      setAddOpen(false);
      await fetchProspects();
    } finally {
      setSaving(false);
    }
  };

  const handleStageChange = async (id: string, stage: ProspectStage) => {
    setProspects((prev) => prev.map((p) => p.id === id ? { ...p, stage } : p));
    await fetch(`/api/admin/prospects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage }),
    });
  };

  const handleNotesChange = async (id: string, notes: string) => {
    await fetch(`/api/admin/prospects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes }),
    });
    setProspects((prev) => prev.map((p) => p.id === id ? { ...p, notes } : p));
    setEditingId(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remove this prospect?")) return;
    await fetch(`/api/admin/prospects/${id}`, { method: "DELETE" });
    setProspects((prev) => prev.filter((p) => p.id !== id));
  };

  const handleCopy = (idx: number, body: string) => {
    navigator.clipboard.writeText(body);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 1500);
  };

  // Summary counts
  const counts = STAGES.reduce((acc, s) => {
    acc[s.key] = prospects.filter((p) => p.stage === s.key).length;
    return acc;
  }, {} as Record<ProspectStage, number>);
  const paidCount = counts.paid;
  const mrr = paidCount * 79;

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex flex-wrap gap-4 text-sm">
          {STAGES.map((s) => (
            <div key={s.key} className="text-center">
              <div className="text-lg font-bold text-gray-800">{counts[s.key]}</div>
              <div className="text-xs text-gray-400">{s.label}</div>
            </div>
          ))}
          <div className="text-center border-l border-gray-100 pl-4">
            <div className="text-lg font-bold text-green-700">${mrr}</div>
            <div className="text-xs text-gray-400">est. MRR</div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setAddOpen((o) => !o)}
          className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          + Add Prospect
        </button>
        <div className="flex gap-2">
          <button
            onClick={() => setTemplatesOpen((o) => !o)}
            className="px-3 py-1.5 text-xs bg-white border border-gray-200 rounded hover:bg-gray-50"
          >
            Response Templates
          </button>
          <button
            onClick={fetchProspects}
            disabled={loading}
            className="px-3 py-1.5 text-xs bg-white border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-50"
          >
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>
      </div>

      {/* Add form */}
      {addOpen && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">New Prospect</p>
          <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input required placeholder="Name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />
            <input required placeholder="Email" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className="border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />
            <input placeholder="Company (optional)" value={form.company} onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
              className="border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />
            <select value={form.stage} onChange={(e) => setForm((f) => ({ ...f, stage: e.target.value as ProspectStage }))}
              className="border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400">
              {STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
            <div className="sm:col-span-2">
              <input placeholder="Reply snippet (first 100 chars)" value={form.replySnippet} onChange={(e) => setForm((f) => ({ ...f, replySnippet: e.target.value }))}
                className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />
            </div>
            <div className="sm:col-span-2">
              <textarea rows={2} placeholder="Notes" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none" />
            </div>
            <div className="sm:col-span-2 flex gap-2">
              <button type="submit" disabled={saving}
                className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50">
                {saving ? "Saving…" : "Add"}
              </button>
              <button type="button" onClick={() => setAddOpen(false)}
                className="px-3 py-1.5 bg-white border border-gray-200 text-sm rounded hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Response Templates */}
      {templatesOpen && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Response Templates</p>
          {TEMPLATES.map((t, idx) => (
            <div key={idx} className="border border-gray-100 rounded p-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-medium text-gray-700">{t.title}</p>
                <button
                  onClick={() => handleCopy(idx, t.body)}
                  className="text-xs text-blue-500 hover:text-blue-700 shrink-0 ml-2"
                >
                  {copiedIdx === idx ? "Copied!" : "Copy"}
                </button>
              </div>
              <pre className="text-xs text-gray-500 whitespace-pre-wrap font-sans">{t.body}</pre>
            </div>
          ))}
        </div>
      )}

      {/* Prospect cards */}
      {prospects.length === 0 && !loading && (
        <div className="text-sm text-gray-400 py-8 text-center">No prospects yet. Add one above.</div>
      )}
      <div className="space-y-2">
        {prospects.map((p) => (
          <div key={p.id} className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm text-gray-800">{p.name}</span>
                  {p.company && <span className="text-xs text-gray-400">{p.company}</span>}
                  {stageBadge(p.stage)}
                  <span className="text-xs text-gray-300">{timeAgo(p.createdAt)}</span>
                </div>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  <a href={`mailto:${p.email}`} className="text-xs text-blue-500 hover:underline">{p.email}</a>
                  {p.replySnippet && (
                    <span className="text-xs text-gray-400 italic">&ldquo;{p.replySnippet.slice(0, 100)}&rdquo;</span>
                  )}
                </div>
                {p.notes && editingId !== p.id && (
                  <p className="text-xs text-gray-500 mt-1">{p.notes}</p>
                )}
                {editingId === p.id && (
                  <NoteEditor defaultValue={p.notes ?? ""} onSave={(v) => handleNotesChange(p.id, v)} onCancel={() => setEditingId(null)} />
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <select
                  value={p.stage}
                  onChange={(e) => handleStageChange(p.id, e.target.value as ProspectStage)}
                  className="text-xs border border-gray-200 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
                >
                  {STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
                <button onClick={() => setEditingId(p.id)} className="text-xs text-gray-400 hover:text-gray-600">Notes</button>
                <button onClick={() => handleDelete(p.id)} className="text-xs text-red-400 hover:text-red-600">Remove</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function NoteEditor({ defaultValue, onSave, onCancel }: { defaultValue: string; onSave: (v: string) => void; onCancel: () => void }) {
  const [val, setVal] = useState(defaultValue);
  return (
    <div className="mt-2 flex gap-2 items-start">
      <textarea rows={2} value={val} onChange={(e) => setVal(e.target.value)}
        className="flex-1 border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none" />
      <div className="flex flex-col gap-1">
        <button onClick={() => onSave(val)} className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700">Save</button>
        <button onClick={onCancel} className="text-xs px-2 py-1 border border-gray-200 rounded hover:bg-gray-50">Cancel</button>
      </div>
    </div>
  );
}

type Tab = "dashboard" | "pipeline";

export default function AdminDashboard() {
  const { user, isLoaded } = useUser();
  const [tab, setTab] = useState<Tab>("dashboard");
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sortField, setSortField] = useState<keyof UserRow>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [extendingId, setExtendingId] = useState<string | null>(null);

  const [testimonials, setTestimonials] = useState<TestimonialRow[]>([]);
  const [testimonialLoading, setTestimonialLoading] = useState(false);
  const [testimonialActingId, setTestimonialActingId] = useState<string | null>(null);
  const [manualForm, setManualForm] = useState({ rating: "5", text: "", name: "", title: "" });
  const [manualSaving, setManualSaving] = useState(false);

  const isAdmin = isLoaded && !!user && ADMIN_EMAILS.includes(user.primaryEmailAddress?.emailAddress ?? "");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/revenue");
      if (res.status === 403) { setError("forbidden"); return; }
      if (!res.ok) throw new Error("Failed to load data");
      setData(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTestimonials = useCallback(async () => {
    setTestimonialLoading(true);
    try {
      const res = await fetch("/api/admin/testimonials");
      if (res.ok) {
        const json = await res.json();
        setTestimonials(json.testimonials ?? []);
      }
    } finally {
      setTestimonialLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) { fetchData(); fetchTestimonials(); }
  }, [isAdmin, fetchData, fetchTestimonials]);

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

  const handleTestimonialApprove = async (id: string, approved: boolean) => {
    setTestimonialActingId(id);
    try {
      await fetch(`/api/admin/testimonials/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approved }),
      });
      await fetchTestimonials();
    } finally {
      setTestimonialActingId(null);
    }
  };

  const handleTestimonialDelete = async (id: string) => {
    if (!confirm("Delete this testimonial?")) return;
    setTestimonialActingId(id);
    try {
      await fetch(`/api/admin/testimonials/${id}`, { method: "DELETE" });
      await fetchTestimonials();
    } finally {
      setTestimonialActingId(null);
    }
  };

  const handleManualCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setManualSaving(true);
    try {
      await fetch("/api/admin/testimonials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...manualForm, rating: Number(manualForm.rating), approved: false }),
      });
      setManualForm({ rating: "5", text: "", name: "", title: "" });
      await fetchTestimonials();
    } finally {
      setManualSaving(false);
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

  const metrics = data?.metrics;
  const featureUsage = data?.featureUsage ?? [];
  const signupsByDay = data?.signupsByDay ?? [];

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">LaneBrief Admin</h1>
            <p className="text-xs text-gray-400">{tab === "dashboard" ? "Revenue Dashboard" : "Sales Pipeline"}</p>
          </div>
          {tab === "dashboard" && (
            <button
              onClick={fetchData}
              disabled={loading}
              className="px-3 py-1.5 text-xs bg-white border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-50"
            >
              {loading ? "Refreshing…" : "Refresh"}
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          {([["dashboard", "Dashboard"], ["pipeline", "Pipeline"]] as [Tab, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === key
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Pipeline tab */}
        {tab === "pipeline" && <PipelineTab />}

        {/* Dashboard tab */}
        {tab === "dashboard" && data && (
          <>
            {/* Key Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <MetricCard label="MRR" value={`$${metrics!.mrr.toLocaleString()}`} />
              <MetricCard label="Active Pro" value={metrics!.activePro} />
              <MetricCard label="Active Trials" value={metrics!.activeTrials} />
              <MetricCard label="Free Users" value={metrics!.activeFree} />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <MetricCard label="Trial → Paid (30d)" value={`${metrics!.conversionRate30d}%`} />
              <MetricCard
                label="Signups"
                value={metrics!.signupsThisMonth}
                sub={`${metrics!.signupsThisWeek} this week · ${metrics!.signupsToday} today`}
              />
              <MetricCard label="Demo Bookings" value={metrics!.demoBookings} />
              <MetricCard
                label="Report Shares"
                value={metrics!.reportSharesTotal}
                sub={`${metrics!.reportSharesConverted} converted`}
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

            {/* Cold Email Stats */}
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
                            <a href={`mailto:${u.email}`} className="text-xs text-blue-500 hover:text-blue-700 underline">
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

            {/* Testimonials */}
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  Testimonials ({testimonials.length})
                </div>
                <button
                  onClick={fetchTestimonials}
                  disabled={testimonialLoading}
                  className="px-3 py-1 text-xs bg-white border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-50"
                >
                  {testimonialLoading ? "Loading…" : "Refresh"}
                </button>
              </div>
              <div className="p-4 space-y-3">
                {testimonials.filter((t) => !t.approved).length === 0 && !testimonialLoading && (
                  <p className="text-xs text-gray-400">No pending testimonials.</p>
                )}
                {testimonials
                  .filter((t) => !t.approved)
                  .map((t) => (
                    <div key={t.id} className="border border-amber-200 bg-amber-50 rounded-lg p-3 flex gap-3 items-start">
                      <div className="flex-1">
                        <TestimonialCard rating={t.rating} text={t.text} name={t.name} title={t.title} />
                      </div>
                      <div className="flex flex-col gap-1.5 shrink-0">
                        <button
                          onClick={() => handleTestimonialApprove(t.id, true)}
                          disabled={testimonialActingId === t.id}
                          className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleTestimonialDelete(t.id)}
                          disabled={testimonialActingId === t.id}
                          className="px-3 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                {testimonials.filter((t) => t.approved).length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 mt-4">Live on site</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {testimonials
                        .filter((t) => t.approved)
                        .map((t) => (
                          <div key={t.id} className="relative">
                            <TestimonialCard rating={t.rating} text={t.text} name={t.name} title={t.title} />
                            <button
                              onClick={() => handleTestimonialApprove(t.id, false)}
                              disabled={testimonialActingId === t.id}
                              className="absolute top-2 right-2 px-2 py-0.5 text-xs bg-gray-200 text-gray-600 rounded hover:bg-gray-300 disabled:opacity-50"
                            >
                              Unpublish
                            </button>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="border-t border-gray-100 px-4 py-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Add manual testimonial</p>
                <form onSubmit={handleManualCreate} className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="sm:col-span-2">
                    <input
                      required
                      placeholder="Name"
                      value={manualForm.name}
                      onChange={(e) => setManualForm((f) => ({ ...f, name: e.target.value }))}
                      className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                    />
                  </div>
                  <input
                    placeholder="Title / company (optional)"
                    value={manualForm.title}
                    onChange={(e) => setManualForm((f) => ({ ...f, title: e.target.value }))}
                    className="border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                  />
                  <select
                    value={manualForm.rating}
                    onChange={(e) => setManualForm((f) => ({ ...f, rating: e.target.value }))}
                    className="border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                  >
                    {[5, 4, 3, 2, 1].map((r) => <option key={r} value={r}>{r} stars</option>)}
                  </select>
                  <div className="sm:col-span-2">
                    <textarea
                      rows={2}
                      maxLength={280}
                      placeholder="Testimonial text (optional, 280 chars)"
                      value={manualForm.text}
                      onChange={(e) => setManualForm((f) => ({ ...f, text: e.target.value }))}
                      className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={manualSaving}
                    className="sm:col-span-2 px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
                  >
                    {manualSaving ? "Saving…" : "Add (pending approval)"}
                  </button>
                </form>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
