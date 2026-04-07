import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/db";
import { apiKeys, users } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const db = getDb();
  const user = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
  if (!user[0]) return Response.json({ error: "User not found" }, { status: 404 });

  await db
    .update(apiKeys)
    .set({ revokedAt: new Date() })
    .where(and(eq(apiKeys.id, id), eq(apiKeys.userId, user[0].id)));

  return Response.json({ success: true });
}
