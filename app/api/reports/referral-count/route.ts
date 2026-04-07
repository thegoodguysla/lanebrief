import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/db";
import { users, reportShares } from "@/lib/db/schema";
import { eq, count } from "drizzle-orm";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();

  const [dbUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkId, userId))
    .limit(1);

  if (!dbUser) return Response.json({ count: 0 });

  const [row] = await db
    .select({ count: count() })
    .from(reportShares)
    .where(eq(reportShares.referrerUserId, dbUser.id));

  return Response.json({ count: row?.count ?? 0 });
}
