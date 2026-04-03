import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/db";
import { users, lanes } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

async function getDbUser(clerkId: string) {
  const db = getDb();
  const [user] = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
  return user ?? null;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const user = await getDbUser(userId);
  if (!user) return Response.json({ error: "User not found" }, { status: 404 });

  const { id: laneId } = await params;
  const body = await req.json() as { alertThresholdPct?: number };
  const { alertThresholdPct } = body;

  if (alertThresholdPct === undefined || typeof alertThresholdPct !== "number") {
    return Response.json({ error: "alertThresholdPct is required" }, { status: 400 });
  }
  if (alertThresholdPct < 1 || alertThresholdPct > 50) {
    return Response.json({ error: "alertThresholdPct must be between 1 and 50" }, { status: 400 });
  }

  const db = getDb();
  const [updated] = await db
    .update(lanes)
    .set({ alertThresholdPct })
    .where(and(eq(lanes.id, laneId), eq(lanes.userId, user.id)))
    .returning();

  if (!updated) return Response.json({ error: "Lane not found" }, { status: 404 });

  return Response.json({ lane: updated });
}
