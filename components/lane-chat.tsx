"use client";

import { useRef, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { cn } from "@/lib/utils";

type LaneData = {
  origin: string;
  destination: string;
  currentRate: number;
  marketAvg: number;
  direction: "up" | "down" | "flat";
  pctChange: number;
  confidence: "high" | "medium" | "low";
  reasoning: string;
  capacityLevel: "tight" | "moderate" | "loose";
  capacityReasoning: string;
  tariff: "MX" | "CA" | null;
  sparkline: number[];
};

type Message = {
  role: "user" | "assistant";
  content: string;
};

const STARTER_QUESTIONS = [
  "Why did rates move this week?",
  "Is now a good time to book?",
  "What carriers typically run this lane?",
  "What is the tariff risk on this lane?",
];

export function LaneChat({ lane }: { lane: LaneData }) {
  const { isSignedIn } = useUser();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function send(text: string) {
    if (!text.trim() || streaming) return;
    if (!isSignedIn) {
      setError("Sign in for free to chat about this lane.");
      return;
    }
    setError(null);
    const userMsg: Message = { role: "user", content: text.trim() };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput("");
    setStreaming(true);

    // Optimistically add an empty assistant message to stream into
    setMessages([...nextMessages, { role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/v1/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lane,
          messages: nextMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        if (res.status === 401) {
          setError("Sign in for free to chat about this lane.");
        } else if (res.status === 429) {
          setError(json.message ?? "Daily limit reached. Upgrade to Pro for unlimited chat.");
        } else {
          setError("Something went wrong. Please try again.");
        }
        // Remove the optimistic empty assistant message
        setMessages(nextMessages);
        setStreaming(false);
        return;
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let assistantText = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          assistantText += decoder.decode(value, { stream: true });
          setMessages([...nextMessages, { role: "assistant", content: assistantText }]);
          bottomRef.current?.scrollIntoView({ behavior: "smooth" });
        }
      }
    } catch {
      setError("Connection error. Please try again.");
      setMessages(nextMessages);
    } finally {
      setStreaming(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    send(input);
  }

  return (
    <>
      {/* Floating chat button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-4 py-3 text-sm font-medium shadow-lg hover:bg-primary/90 transition-all"
          aria-label="Ask about this lane"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-4">
            <path fillRule="evenodd" d="M4.848 2.771A49.144 49.144 0 0 1 12 2.25c2.43 0 4.817.178 7.152.52 1.978.292 3.348 2.024 3.348 3.97v6.02c0 1.946-1.37 3.678-3.348 3.97a48.901 48.901 0 0 1-3.476.383.39.39 0 0 0-.297.17l-2.755 4.133a.75.75 0 0 1-1.248 0l-2.755-4.133a.39.39 0 0 0-.297-.17 48.9 48.9 0 0 1-3.476-.384c-1.978-.29-3.348-2.024-3.348-3.97V6.741c0-1.946 1.37-3.68 3.348-3.97Z" clipRule="evenodd" />
          </svg>
          Ask about this lane
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-0 right-0 z-50 flex flex-col w-full sm:w-96 h-[480px] sm:bottom-6 sm:right-6 sm:rounded-xl border border-border bg-background shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
            <div className="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-4 text-primary">
                <path fillRule="evenodd" d="M4.848 2.771A49.144 49.144 0 0 1 12 2.25c2.43 0 4.817.178 7.152.52 1.978.292 3.348 2.024 3.348 3.97v6.02c0 1.946-1.37 3.678-3.348 3.97a48.901 48.901 0 0 1-3.476.383.39.39 0 0 0-.297.17l-2.755 4.133a.75.75 0 0 1-1.248 0l-2.755-4.133a.39.39 0 0 0-.297-.17 48.9 48.9 0 0 1-3.476-.384c-1.978-.29-3.348-2.024-3.348-3.97V6.741c0-1.946 1.37-3.68 3.348-3.97Z" clipRule="evenodd" />
              </svg>
              <span className="text-sm font-semibold">Lane Chat</span>
              <span className="text-xs text-muted-foreground">AI analyst</span>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Close chat"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-4">
                <path fillRule="evenodd" d="M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 1 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.length === 0 && (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground text-center">
                  Ask anything about the {lane.origin} → {lane.destination} lane
                </p>
                <div className="grid grid-cols-1 gap-2">
                  {STARTER_QUESTIONS.map((q) => (
                    <button
                      key={q}
                      onClick={() => send(q)}
                      disabled={!isSignedIn}
                      className="text-left text-xs px-3 py-2 rounded-lg border border-border bg-muted/30 hover:bg-muted hover:border-primary/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {q}
                    </button>
                  ))}
                </div>
                {!isSignedIn && (
                  <p className="text-xs text-center text-muted-foreground">
                    <a href="/sign-in" className="underline hover:text-foreground">Sign in</a> or{" "}
                    <a href="/sign-up" className="underline hover:text-foreground">create a free account</a> to chat
                  </p>
                )}
              </div>
            )}

            {messages.map((msg, i) => (
              <div
                key={i}
                className={cn(
                  "flex",
                  msg.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap",
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
                  )}
                >
                  {msg.content || (
                    <span className="inline-flex gap-1 items-center text-muted-foreground">
                      <span className="animate-pulse">●</span>
                      <span className="animate-pulse" style={{ animationDelay: "0.2s" }}>●</span>
                      <span className="animate-pulse" style={{ animationDelay: "0.4s" }}>●</span>
                    </span>
                  )}
                </div>
              </div>
            ))}

            {error && (
              <div className="text-xs text-center text-destructive bg-destructive/10 rounded-lg px-3 py-2">
                {error}{" "}
                {error.includes("Upgrade") && (
                  <a href="/pricing" className="underline font-medium">Upgrade to Pro</a>
                )}
                {error.includes("Sign in") && (
                  <a href="/sign-in" className="underline font-medium">Sign in</a>
                )}
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSubmit} className="px-3 py-3 border-t border-border flex gap-2">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={isSignedIn ? "Ask about rates, capacity, timing…" : "Sign in to chat"}
              disabled={!isSignedIn || streaming}
              className="flex-1 text-sm bg-muted/40 border border-border rounded-lg px-3 py-2 outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 disabled:opacity-50 placeholder:text-muted-foreground"
              autoComplete="off"
            />
            <button
              type="submit"
              disabled={!input.trim() || streaming || !isSignedIn}
              className="flex-shrink-0 rounded-lg bg-primary text-primary-foreground px-3 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              aria-label="Send"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-4">
                <path d="M3.478 2.405a.75.75 0 0 0-.926.94l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.405Z" />
              </svg>
            </button>
          </form>
        </div>
      )}
    </>
  );
}
