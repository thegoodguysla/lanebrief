import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/db";
import { affiliates, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const ADMIN_EMAILS = ["nick@lanebrief.com", "nick@thegoodguys.la"];

// POST /api/admin/affiliates/approve
// Body: { affiliateId, status: 'approved' | 'rejected' }
export async function POST(req: Request) {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const [caller] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.clerkId, clerkUserId))
    .limit(1);

  if (!caller || !ADMIN_EMAILS.includes(caller.email)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { affiliateId, status } = await req.json() as { affiliateId: string; status: string };

  if (!affiliateId || !["approved", "rejected"].includes(status)) {
    return Response.json({ error: "affiliateId and status ('approved'|'rejected') required" }, { status: 400 });
  }

  const [updated] = await db
    .update(affiliates)
    .set({ status, updatedAt: new Date() })
    .where(eq(affiliates.id, affiliateId))
    .returning();

  if (!updated) return Response.json({ error: "Affiliate not found" }, { status: 404 });

  console.log(`Admin ${caller.email} set affiliate ${affiliateId} → ${status}`);
  return Response.json({ affiliate: updated });
}
