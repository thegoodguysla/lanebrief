import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/db";
import { users, teams, teamMembers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// GET /api/team/members — list the owner's team members

export async function GET() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const [dbUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkId, userId))
    .limit(1);

  if (!dbUser) return Response.json({ error: "User not found" }, { status: 404 });

  const team = await db.query.teams.findFirst({ where: eq(teams.ownerUserId, dbUser.id) });
  if (!team) return Response.json({ team: null, members: [], seatCount: 3 });

  const members = await db
    .select({
      id: teamMembers.id,
      email: teamMembers.email,
      status: teamMembers.status,
      invitedAt: teamMembers.invitedAt,
      joinedAt: teamMembers.joinedAt,
    })
    .from(teamMembers)
    .where(eq(teamMembers.teamId, team.id));

  return Response.json({ team: { id: team.id, name: team.name, seatCount: team.seatCount }, members });
}
