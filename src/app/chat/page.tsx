"use client";

// Throwaway. This page exists to prove the streaming path works end to end
// before Saturday. Delete it once the real product exists.

import { useChat } from "@ai-sdk/react";
import { useState } from "react";

export default function Chat() {
  const [input, setInput] = useState("");
  const { messages, sendMessage, status } = useChat();
  const busy = status === "submitted" || status === "streaming";

  return (
    <div className="mx-auto flex h-screen max-w-2xl flex-col gap-4 p-6">
      <header className="flex items-baseline justify-between border-b border-zinc-200 pb-3 dark:border-zinc-800">
        <h1 className="font-semibold">Streaming test</h1>
      </header>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto">
        {messages.length === 0 && (
          <p className="text-sm text-zinc-500">
            Ask something. If the answer streams in word by word rather than
            appearing all at once, the whole path works.
          </p>
        )}

        {messages.map((m) => (
          <div key={m.id} className="flex flex-col gap-1">
            <span className="font-mono text-xs uppercase tracking-widest text-zinc-500">
              {m.role}
            </span>
            <div className="whitespace-pre-wrap">
              {m.parts.map((part, i) =>
                part.type === "text" ? <span key={i}>{part.text}</span> : null,
              )}
            </div>
          </div>
        ))}

        {status === "submitted" && (
          <span className="text-sm text-zinc-500">Thinking…</span>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!input.trim() || busy) return;
          sendMessage({ text: input });
          setInput("");
        }}
        className="flex gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-800"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask something…"
          aria-label="Message"
          className="flex-1 rounded-lg border border-zinc-300 bg-transparent px-3 py-2 outline-none focus:border-zinc-500 dark:border-zinc-700"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-white disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
        >
          Send
        </button>
      </form>
    </div>
  );
}
