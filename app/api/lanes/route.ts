import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/db";
import { users, lanes } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "crypto";

const MAX_LANES = 5;

async function getDbUser(clerkId: string) {
  const db = getDb();
  const [user] = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
  return user ?? null;
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const user = await getDbUser(userId);
  if (!user) return Response.json({ error: "User not found — call /api/user/sync first" }, { status: 404 });

  const db = getDb();
  const userLanes = await db.select().from(lanes).where(eq(lanes.userId, user.id));
  return Response.json({ lanes: userLanes });
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const user = await getDbUser(userId);
  if (!user) return Response.json({ error: "User not found — call /api/user/sync first" }, { status: 404 });

  const db = getDb();
  const existing = await db.select().from(lanes).where(eq(lanes.userId, user.id));
  if (existing.length >= MAX_LANES) {
    return Response.json({ error: `Maximum ${MAX_LANES} lanes allowed` }, { status: 422 });
  }

  const body = await req.json();
  const { origin, destination, equipment = "dry_van" } = body as {
    origin: string;
    destination: string;
    equipment?: string;
  };

  if (!origin || !destination) {
    return Response.json({ error: "origin and destination are required" }, { status: 400 });
  }

  const [lane] = await db
    .insert(lanes)
    .values({ id: randomUUID(), userId: user.id, origin, destination, equipment })
    .returning();

  return Response.json({ lane }, { status: 201 });
}

export async function DELETE(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const user = await getDbUser(userId);
  if (!user) return Response.json({ error: "User not found" }, { status: 404 });

  const { laneId } = await req.json() as { laneId: string };
  if (!laneId) return Response.json({ error: "laneId required" }, { status: 400 });

  const db = getDb();
  await db.delete(lanes).where(and(eq(lanes.id, laneId), eq(lanes.userId, user.id)));
  return Response.json({ ok: true });
}
