import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";

// Composio redirects here after OAuth completes.
// The connection is finalized on Composio's side automatically.
// We just redirect the user back to the dashboard with a success flag.
export async function GET(req: NextRequest) {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return Response.redirect(new URL("/sign-in", req.url));
  }

  const tool = req.nextUrl.searchParams.get("tool") ?? "integration";
  return Response.redirect(
    new URL(`/dashboard?connected=${encodeURIComponent(tool)}`, req.url)
  );
}
