import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getEntity, listConnections } from "@/lib/composio";

export async function GET() {
  const { userId: clerkId } = await auth();
  if (!clerkId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.clerkId, clerkId));
  if (!user) return Response.json({ error: "User not found" }, { status: 404 });

  try {
    const connections = await listConnections(user.id);
    return Response.json({ connections });
  } catch (err) {
    console.error("[integrations] listConnections error:", err);
    return Response.json({ connections: [] });
  }
}

export async function DELETE(req: Request) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.clerkId, clerkId));
  if (!user) return Response.json({ error: "User not found" }, { status: 404 });

  const { tool } = await req.json() as { tool: string };
  if (!tool) return Response.json({ error: "tool is required" }, { status: 400 });

  try {
    const entity = await getEntity(user.id);
    const connections = await entity.getConnections();
    const conn = connections.find(
      (c) => (c.appName ?? c.appUniqueId ?? "").toLowerCase() === tool.toLowerCase()
    );
    if (conn?.id) {
      await entity.execute({ actionName: "COMPOSIO_DELETE_CONNECTION", params: { connectionId: conn.id } });
    }
    return Response.json({ ok: true });
  } catch (err) {
    console.error("[integrations] disconnect error:", err);
    return Response.json({ error: "Failed to disconnect" }, { status: 500 });
  }
}
