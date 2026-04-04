// Vercel Cron: every Tuesday 9am ET (14:00 UTC)
// vercel.json schedule: "0 14 * * 2"
//
// Phase 1 — read-only observer. Queries GitHub Actions API for latest
// code-health-pr run results and npm registry for outdated packages,
// then posts a weekly digest comment to the Paperclip ops issue.

const GITHUB_REPO = "thegoodguysla/lanebrief";
const PAPERCLIP_OPS_ISSUE_ID = process.env.PAPERCLIP_OPS_ISSUE_ID ?? "";

type WorkflowRun = {
  id: number;
  name: string;
  conclusion: string | null;
  status: string;
  html_url: string;
  created_at: string;
  head_commit?: { message?: string };
  head_sha: string;
};

type WorkflowJob = {
  name: string;
  conclusion: string | null;
  steps?: { name: string; conclusion: string | null }[];
};

async function getLatestCodeHealthRun(token: string): Promise<WorkflowRun | null> {
  const res = await fetch(
    `https://api.github.com/repos/${GITHUB_REPO}/actions/workflows/code-health-pr.yml/runs?branch=main&per_page=5`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    }
  );
  if (!res.ok) return null;
  const data = (await res.json()) as { workflow_runs: WorkflowRun[] };
  return data.workflow_runs.find((r) => r.conclusion !== null) ?? null;
}

async function getRunJobs(token: string, runId: number): Promise<WorkflowJob[]> {
  const res = await fetch(
    `https://api.github.com/repos/${GITHUB_REPO}/actions/runs/${runId}/jobs`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    }
  );
  if (!res.ok) return [];
  const data = (await res.json()) as { jobs: WorkflowJob[] };
  return data.jobs;
}

type NpmPackageInfo = { "dist-tags": { latest: string } };

async function checkOutdatedPackages(): Promise<{ name: string; current: string; latest: string }[]> {
  // Read package.json dependencies from the file system isn't possible at runtime,
  // so we check the known pinned deps against npm registry for the most critical ones.
  const packagesToCheck = [
    { name: "next", current: "16.2.2" },
    { name: "react", current: "19.2.4" },
    { name: "@clerk/nextjs", current: "7.0.8" },
    { name: "drizzle-orm", current: "0.45.2" },
    { name: "resend", current: "6.10.0" },
    { name: "stripe", current: "21.0.1" },
    { name: "ai", current: "6.0.142" },
  ];

  const outdated: { name: string; current: string; latest: string }[] = [];

  await Promise.allSettled(
    packagesToCheck.map(async ({ name, current }) => {
      try {
        const res = await fetch(`https://registry.npmjs.org/${name}/latest`, {
          headers: { Accept: "application/json" },
        });
        if (!res.ok) return;
        const data = (await res.json()) as { version: string };
        const latest = data.version;
        if (latest && latest !== current) {
          outdated.push({ name, current, latest });
        }
      } catch {
        // Registry check failed — skip
      }
    })
  );

  return outdated;
}

async function postPaperclipComment(body: string): Promise<void> {
  const apiUrl = process.env.PAPERCLIP_API_URL;
  const apiKey = process.env.PAPERCLIP_SERVICE_KEY; // server-side service key
  if (!apiUrl || !apiKey || !PAPERCLIP_OPS_ISSUE_ID) {
    console.warn("[code-health-digest] PAPERCLIP env vars not set — skipping Paperclip post");
    return;
  }

  const res = await fetch(`${apiUrl}/api/issues/${PAPERCLIP_OPS_ISSUE_ID}/comments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ body }),
  });

  if (!res.ok) {
    console.error("[code-health-digest] Failed to post to Paperclip:", await res.text());
  }
}

export async function GET(req: Request): Promise<Response> {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const githubToken = process.env.GITHUB_TOKEN;
  if (!githubToken) {
    console.error("[code-health-digest] GITHUB_TOKEN not set");
    return Response.json({ ok: false, error: "GITHUB_TOKEN not configured" }, { status: 500 });
  }

  const date = new Date().toISOString().slice(0, 10);

  // 1 — Get latest completed code-health run on main
  const latestRun = await getLatestCodeHealthRun(githubToken);

  let ciSummary = "⚪ No recent runs found on main branch";
  let ciSignal: "green" | "yellow" | "red" = "yellow";
  let runUrl = `https://github.com/${GITHUB_REPO}/actions`;

  if (latestRun) {
    runUrl = latestRun.html_url;
    const jobs = await getRunJobs(githubToken, latestRun.id);
    const jobLines = jobs.map((j) => {
      const icon = j.conclusion === "success" ? "✅" : j.conclusion === "failure" ? "❌" : "⚪";
      return `  - ${icon} ${j.name}`;
    });

    if (latestRun.conclusion === "success") {
      ciSignal = "green";
      ciSummary = `✅ All checks passed on main (run from ${latestRun.created_at.slice(0, 10)})\n${jobLines.join("\n")}`;
    } else {
      ciSignal = "red";
      ciSummary = `❌ ${latestRun.conclusion ?? "unknown"} on main (run from ${latestRun.created_at.slice(0, 10)})\n${jobLines.join("\n")}`;
    }
  }

  // 2 — Check for outdated packages
  const outdated = await checkOutdatedPackages();
  let outdatedSummary: string;
  if (outdated.length === 0) {
    outdatedSummary = "✅ All monitored packages are current";
  } else {
    const lines = outdated.map((p) => `  - \`${p.name}\`: ${p.current} → ${p.latest}`);
    outdatedSummary = `📦 ${outdated.length} package(s) have updates available:\n${lines.join("\n")}`;
  }

  // 3 — No test coverage yet (no test framework installed)
  const coverageSummary = "⚪ No test framework installed — coverage not available yet";

  // 4 — Overall signal
  const overallSignal =
    ciSignal === "green" && outdated.length === 0
      ? "🟢 Healthy"
      : ciSignal === "red"
        ? "🔴 Needs attention"
        : "🟡 Minor issues";

  const comment = `## Weekly Code Health Digest — ${date}

**Overall: ${overallSignal}**

### CI / Code Quality (main branch)
${ciSummary}

### Dependency Updates
${outdatedSummary}

### Test Coverage
${coverageSummary}

---
> Phase 1 — read-only observer. No auto-fixes applied.
> [View GitHub Actions runs](${runUrl})`;

  console.log(`[code-health-digest] ${date} — ${overallSignal}`);
  await postPaperclipComment(comment);

  return Response.json({
    ok: true,
    date,
    signal: overallSignal,
    ciConclusion: latestRun?.conclusion ?? null,
    outdatedCount: outdated.length,
  });
}
