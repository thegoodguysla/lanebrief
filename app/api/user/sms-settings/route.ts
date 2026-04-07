import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function PATCH(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    smsAlertOptIn?: boolean;
    smsWeeklyOptIn?: boolean;
  };

  const updates: Partial<{ smsAlertOptIn: boolean; smsWeeklyOptIn: boolean; updatedAt: Date }> = {
    updatedAt: new Date(),
  };

  if (typeof body.smsAlertOptIn === "boolean") updates.smsAlertOptIn = body.smsAlertOptIn;
  if (typeof body.smsWeeklyOptIn === "boolean") updates.smsWeeklyOptIn = body.smsWeeklyOptIn;

  if (Object.keys(updates).length === 1) {
    return Response.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const db = getDb();
  const [updated] = await db
    .update(users)
    .set(updates)
    .where(eq(users.clerkId, userId))
    .returning({ smsAlertOptIn: users.smsAlertOptIn, smsWeeklyOptIn: users.smsWeeklyOptIn });

  if (!updated) return Response.json({ error: "User not found" }, { status: 404 });

  return Response.json(updated);
}
