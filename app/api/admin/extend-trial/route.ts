import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const ADMIN_EMAILS = ["nick@lanebrief.com", "nick@thegoodguys.la"];

// POST /api/admin/extend-trial
// Body: { userId: string }
// Extends a user's trial by 7 days from today (or from current trialEndsAt if still in future).
export async function POST(req: Request) {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const [callerUser] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.clerkId, clerkUserId))
    .limit(1);

  if (!callerUser || !ADMIN_EMAILS.includes(callerUser.email)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { userId } = await req.json() as { userId: string };
  if (!userId) return Response.json({ error: "userId required" }, { status: 400 });

  const [targetUser] = await db
    .select({ id: users.id, email: users.email, trialEndsAt: users.trialEndsAt })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!targetUser) return Response.json({ error: "User not found" }, { status: 404 });

  const now = new Date();
  const base = targetUser.trialEndsAt && new Date(targetUser.trialEndsAt) > now
    ? new Date(targetUser.trialEndsAt)
    : now;
  const newTrialEndsAt = new Date(base.getTime() + 7 * 24 * 60 * 60 * 1000);

  await db
    .update(users)
    .set({ trialEndsAt: newTrialEndsAt, updatedAt: now })
    .where(eq(users.id, userId));

  return Response.json({ ok: true, userId, trialEndsAt: newTrialEndsAt.toISOString() });
}
