import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/db";
import { users, teams, teamMembers } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

// DELETE /api/team/members/[id] — owner removes a team member

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id: memberId } = await params;

  const db = getDb();
  const [dbUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkId, userId))
    .limit(1);

  if (!dbUser) return Response.json({ error: "User not found" }, { status: 404 });

  // Verify caller is the team owner
  const team = await db.query.teams.findFirst({ where: eq(teams.ownerUserId, dbUser.id) });
  if (!team) return Response.json({ error: "No team found" }, { status: 404 });

  const [deleted] = await db
    .delete(teamMembers)
    .where(and(eq(teamMembers.id, memberId), eq(teamMembers.teamId, team.id)))
    .returning({ id: teamMembers.id, userId: teamMembers.userId });

  if (!deleted) return Response.json({ error: "Member not found" }, { status: 404 });

  // Clear teamId from the removed user's record
  if (deleted.userId) {
    await db.update(users).set({ teamId: null, updatedAt: new Date() }).where(eq(users.id, deleted.userId));
  }

  console.log(`[team/members] Removed member ${memberId} from team ${team.id}`);
  return Response.json({ success: true });
}
