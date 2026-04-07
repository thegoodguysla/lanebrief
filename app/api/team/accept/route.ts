import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/db";
import { users, teamMembers } from "@/lib/db/schema";
import { eq, and, gt } from "drizzle-orm";

// POST /api/team/accept — authenticated user accepts a team invite by token

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json() as { token?: string };
  const token = (body.token ?? "").trim();
  if (!token) return Response.json({ error: "Token required" }, { status: 400 });

  const db = getDb();
  const [dbUser] = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.clerkId, userId))
    .limit(1);

  if (!dbUser) return Response.json({ error: "User not found" }, { status: 404 });

  const now = new Date();
  const [invite] = await db
    .select()
    .from(teamMembers)
    .where(
      and(
        eq(teamMembers.inviteToken, token),
        eq(teamMembers.status, "pending"),
        gt(teamMembers.inviteExpiresAt, now)
      )
    )
    .limit(1);

  if (!invite) return Response.json({ error: "Invite not found or expired" }, { status: 404 });

  // Accept: mark active, link user
  await db
    .update(teamMembers)
    .set({
      status: "active",
      userId: dbUser.id,
      email: dbUser.email, // normalize to actual email
      joinedAt: now,
      inviteToken: null,
      inviteExpiresAt: null,
    })
    .where(eq(teamMembers.id, invite.id));

  // Set teamId on user record
  await db
    .update(users)
    .set({ teamId: invite.teamId, updatedAt: now })
    .where(eq(users.id, dbUser.id));

  console.log(`[team/accept] User ${dbUser.id} joined team ${invite.teamId}`);
  return Response.json({ success: true, teamId: invite.teamId });
}
