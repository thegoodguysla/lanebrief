"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

type ApiKeyRow = {
  id: string;
  name: string;
  keyPrefix: string;
  usageCount: number;
  usageResetAt: string;
  createdAt: string;
};

const PRO_MONTHLY_LIMIT = 1000;

export function ApiAccessManager() {
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [planTier, setPlanTier] = useState<string>("free");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [creating, setCreating] = useState(false);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);

  async function fetchKeys() {
    setLoading(true);
    try {
      const res = await fetch("/api/user/api-keys");
      if (res.ok) {
        const data = await res.json();
        setKeys(data.keys ?? []);
        setPlanTier(data.planTier ?? "free");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchKeys(); }, []);

  async function createKey() {
    setCreating(true);
    try {
      const res = await fetch("/api/user/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newKeyName || "Default" }),
      });
      if (res.ok) {
        const data = await res.json();
        setRevealedKey(data.key);
        setNewKeyName("");
        setShowForm(false);
        await fetchKeys();
      }
    } finally {
      setCreating(false);
    }
  }

  async function revokeKey(id: string) {
    setRevoking(id);
    try {
      await fetch(`/api/user/api-keys/${id}`, { method: "DELETE" });
      setKeys((prev) => prev.filter((k) => k.id !== id));
    } finally {
      setRevoking(null);
    }
  }

  function copyKey() {
    if (!revealedKey) return;
    navigator.clipboard.writeText(revealedKey).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const isPro = planTier === "pro" || planTier === "enterprise";

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            API Access
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Integrate LaneBrief data into your TMS or spreadsheets.{" "}
            <Link href="/api-docs" className="text-primary underline underline-offset-2 hover:text-primary/80">
              View docs →
            </Link>
          </p>
        </div>
        {isPro && (
          <Button size="sm" variant="outline" onClick={() => setShowForm((v) => !v)}>
            {showForm ? "Cancel" : "Generate New Key"}
          </Button>
        )}
      </div>

      {!isPro && (
        <div className="rounded-lg border border-border bg-muted/30 px-5 py-4 space-y-2">
          <p className="text-sm font-medium">API access requires Pro or Enterprise</p>
          <p className="text-xs text-muted-foreground">
            Upgrade to Pro ($79/mo) to get API access with 1,000 requests/month, or Enterprise for unlimited calls.
          </p>
          <Link
            href="/pricing"
            className="inline-block text-xs font-medium text-primary underline underline-offset-2 hover:text-primary/80"
          >
            View pricing →
          </Link>
        </div>
      )}

      {isPro && showForm && (
        <div className="rounded-lg border border-border p-4 space-y-3">
          <p className="text-sm font-medium">New API key</p>
          <div className="flex gap-2">
            <Input
              placeholder="Key name (e.g. Production TMS)"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              className="flex-1 text-sm"
              maxLength={64}
            />
            <Button size="sm" onClick={createKey} disabled={creating}>
              {creating ? "Generating…" : "Generate"}
            </Button>
          </div>
        </div>
      )}

      {revealedKey && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-700/40 p-4 space-y-3">
          <div className="flex items-start gap-2">
            <span className="text-amber-600 dark:text-amber-400 font-semibold text-sm shrink-0">Save this key now</span>
          </div>
          <p className="text-xs text-amber-700 dark:text-amber-300">
            This is the only time your full API key will be shown. Copy it and store it securely — it cannot be retrieved later.
          </p>
          <div className="flex gap-2 items-center">
            <code className="flex-1 rounded bg-background border border-border px-3 py-2 text-xs font-mono break-all">
              {revealedKey}
            </code>
            <Button size="sm" variant="outline" onClick={copyKey}>
              {copied ? "Copied!" : "Copy"}
            </Button>
          </div>
          <button
            onClick={() => setRevealedKey(null)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            I&apos;ve saved it — dismiss
          </button>
        </div>
      )}

      {isPro && (
        <div className="rounded-lg border border-border divide-y divide-border">
          {loading ? (
            <div className="px-4 py-6 text-sm text-muted-foreground text-center">Loading…</div>
          ) : keys.length === 0 ? (
            <div className="px-4 py-6 text-sm text-muted-foreground text-center">
              No API keys yet. Generate one above to get started.
            </div>
          ) : (
            keys.map((key) => {
              const resetMonth = new Date(key.usageResetAt).toLocaleString("en-US", { month: "short", year: "numeric" });
              const usagePct = planTier === "pro" ? Math.min((key.usageCount / PRO_MONTHLY_LIMIT) * 100, 100) : null;

              return (
                <div key={key.id} className="px-4 py-3 flex items-start justify-between gap-4">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{key.name}</span>
                      <code className="text-xs text-muted-foreground font-mono">{key.keyPrefix}</code>
                      {planTier === "enterprise" && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Enterprise</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Created {new Date(key.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                    {planTier === "pro" && usagePct !== null && (
                      <div className="space-y-1 pt-1">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{key.usageCount.toLocaleString()} / {PRO_MONTHLY_LIMIT.toLocaleString()} requests this month ({resetMonth})</span>
                          <span>{Math.round(usagePct)}%</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary transition-all"
                            style={{ width: `${usagePct}%` }}
                          />
                        </div>
                      </div>
                    )}
                    {planTier === "enterprise" && (
                      <p className="text-xs text-muted-foreground">
                        {key.usageCount.toLocaleString()} requests this month — unlimited
                      </p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                    onClick={() => revokeKey(key.id)}
                    disabled={revoking === key.id}
                  >
                    {revoking === key.id ? "Revoking…" : "Revoke"}
                  </Button>
                </div>
              );
            })
          )}
        </div>
      )}
    </section>
  );
}
