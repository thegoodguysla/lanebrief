"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useUser, SignInButton } from "@clerk/nextjs";
import Link from "next/link";

export default function JoinPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [status, setStatus] = useState<"idle" | "accepting" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  // Auto-accept once the user is signed in and token is present
  useEffect(() => {
    if (!isLoaded || !user || !token || status !== "idle") return;
    accept();
  }, [isLoaded, user, token, status]); // eslint-disable-line react-hooks/exhaustive-deps

  async function accept() {
    setStatus("accepting");
    try {
      const res = await fetch("/api/team/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (res.ok) {
        setStatus("success");
        setTimeout(() => router.push("/dashboard"), 2000);
      } else {
        const data = await res.json() as { error?: string };
        setErrorMsg(data.error ?? "Could not accept invite");
        setStatus("error");
      }
    } catch {
      setErrorMsg("Network error — please try again");
      setStatus("error");
    }
  }

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground text-sm">Loading…</p>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="max-w-sm w-full text-center space-y-4">
          <h1 className="text-xl font-semibold">Invalid invite link</h1>
          <p className="text-sm text-muted-foreground">
            This link is missing a token. Check that you copied the full link from your email.
          </p>
          <Link href="/" className="text-sm text-primary underline underline-offset-2">
            Go to LaneBrief
          </Link>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="max-w-sm w-full space-y-6 text-center">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold">You've been invited to LaneBrief</h1>
            <p className="text-sm text-muted-foreground">
              Sign in or create an account to accept your team invite and start tracking freight lanes.
            </p>
          </div>
          <SignInButton
            mode="modal"
            forceRedirectUrl={`/join?token=${token}`}
          >
            <button className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 transition-colors">
              Accept invite and set up your account
            </button>
          </SignInButton>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-sm w-full text-center space-y-4">
        {status === "accepting" && (
          <>
            <div className="text-3xl">⏳</div>
            <h1 className="text-xl font-semibold">Accepting invite…</h1>
            <p className="text-sm text-muted-foreground">Just a moment.</p>
          </>
        )}
        {status === "success" && (
          <>
            <div className="text-3xl">✅</div>
            <h1 className="text-xl font-semibold">You're in!</h1>
            <p className="text-sm text-muted-foreground">
              Redirecting you to your dashboard…
            </p>
          </>
        )}
        {status === "error" && (
          <>
            <div className="text-3xl">⚠️</div>
            <h1 className="text-xl font-semibold">Invite failed</h1>
            <p className="text-sm text-muted-foreground">{errorMsg}</p>
            <Link href="/dashboard" className="text-sm text-primary underline underline-offset-2">
              Go to dashboard
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
