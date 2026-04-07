import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/db";
import { affiliates, affiliateEarnings, users } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

const ADMIN_EMAILS = ["nick@lanebrief.com", "nick@thegoodguys.la"];

async function requireAdmin(clerkUserId: string) {
  const db = getDb();
  const [caller] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.clerkId, clerkUserId))
    .limit(1);
  return caller && ADMIN_EMAILS.includes(caller.email) ? caller : null;
}

// GET /api/admin/affiliates — list all affiliates
export async function GET() {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await requireAdmin(clerkUserId))) return Response.json({ error: "Forbidden" }, { status: 403 });

  const db = getDb();
  const rows = await db.select().from(affiliates).orderBy(desc(affiliates.createdAt));

  return Response.json({ affiliates: rows });
}
