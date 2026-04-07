import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getConnectionUrl } from "@/lib/composio";

const ALLOWED_TOOLS = ["slack", "googlesheets", "hubspot"] as const;
type AllowedTool = (typeof ALLOWED_TOOLS)[number];

export async function POST(req: Request) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.clerkId, clerkId));
  if (!user) return Response.json({ error: "User not found" }, { status: 404 });

  const { tool } = await req.json() as { tool: string };
  if (!ALLOWED_TOOLS.includes(tool as AllowedTool)) {
    return Response.json({ error: `tool must be one of: ${ALLOWED_TOOLS.join(", ")}` }, { status: 400 });
  }

  const origin = req.headers.get("origin") ?? "https://lanebrief.com";
  const redirectUri = `${origin}/api/user/integrations/callback?tool=${tool}`;

  try {
    const redirectUrl = await getConnectionUrl(user.id, tool, redirectUri);
    return Response.json({ redirectUrl });
  } catch (err) {
    console.error("[integrations/connect] error:", err);
    return Response.json({ error: "Failed to initiate connection" }, { status: 500 });
  }
}
