import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { sendIntelligenceReportForUser } from "@/app/api/cron/weekly-intelligence-report/route";

// POST /api/admin/send-weekly-report?userId=X
// Manual trigger for sending the weekly intelligence report to a specific user.
// Requires: admin-level Clerk user (checks ADMIN_USER_IDS env var).

export async function POST(req: Request) {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const adminIds = (process.env.ADMIN_USER_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!adminIds.includes(clerkUserId)) {
    return Response.json({ error: "Forbidden — admin only" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const targetUserId = searchParams.get("userId");

  const db = getDb();

  if (targetUserId) {
    // Send to specific user
    const [targetUser] = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(eq(users.id, targetUserId))
      .limit(1);

    if (!targetUser) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    const result = await sendIntelligenceReportForUser(targetUser.id, targetUser.email, db);
    return Response.json({ ok: true, userId: targetUser.id, email: targetUser.email, result });
  }

  // Send to all users (batch manual trigger)
  const allUsers = await db.select({ id: users.id, email: users.email }).from(users);
  let sent = 0;
  let skipped = 0;
  let errors = 0;

  for (const user of allUsers) {
    const result = await sendIntelligenceReportForUser(user.id, user.email, db);
    if (result === "sent") sent++;
    else if (result === "skipped") skipped++;
    else errors++;
  }

  return Response.json({ ok: true, sent, skipped, errors });
}
