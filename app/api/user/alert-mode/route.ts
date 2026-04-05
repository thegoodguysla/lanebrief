import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function PATCH(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as { alertMode?: string };
  if (body.alertMode !== "instant" && body.alertMode !== "digest") {
    return Response.json({ error: "alertMode must be 'instant' or 'digest'" }, { status: 400 });
  }

  const db = getDb();
  const [updated] = await db
    .update(users)
    .set({ alertMode: body.alertMode, updatedAt: new Date() })
    .where(eq(users.clerkId, userId))
    .returning();

  if (!updated) return Response.json({ error: "User not found" }, { status: 404 });

  return Response.json({ alertMode: updated.alertMode });
}
