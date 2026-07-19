"use client";

import { useState } from "react";

type ChatResult = {
  ok: boolean;
  model: string;
  mode?: "text" | "object";
  result?: unknown;
  error?: string;
};

export default function ChatDiagnosticPage() {
  const [message, setMessage] = useState("Say hello in one word");
  const [loading, setLoading] = useState<"text" | "object" | null>(null);
  const [response, setResponse] = useState<ChatResult | null>(null);

  async function runTest(mode: "text" | "object") {
    setLoading(mode);
    setResponse(null);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, mode }),
      });
      const data: ChatResult = await res.json();
      setResponse(data);
    } catch (e) {
      setResponse({
        ok: false,
        model: "unknown",
        error: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="mx-auto max-w-xl p-6 space-y-4">
      <div>
        <h1 className="text-xl font-bold">Chat diagnostic tool</h1>
        <p className="text-sm text-gray-500">
          Dev-only page to verify the OpenAI integration (plain text and structured
          output). Not product UI.
        </p>
        {response && (
          <p className="text-sm text-gray-500">
            Model in use: <span className="font-mono">{response.model}</span>
          </p>
        )}
      </div>

      <input
        className="w-full border rounded p-2"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />

      <div className="flex gap-2">
        <button
          className="border rounded px-3 py-1 disabled:opacity-50"
          disabled={loading !== null}
          onClick={() => runTest("text")}
        >
          {loading === "text" ? "Testing…" : "Test (text)"}
        </button>
        <button
          className="border rounded px-3 py-1 disabled:opacity-50"
          disabled={loading !== null}
          onClick={() => runTest("object")}
        >
          {loading === "object" ? "Testing…" : "Test (structured)"}
        </button>
      </div>

      {response && (
        <div className="border rounded p-3 space-y-2">
          <p>
            ok: <span className="font-mono">{String(response.ok)}</span>
          </p>
          <p>
            model: <span className="font-mono">{response.model}</span>
          </p>
          {response.ok ? (
            <pre className="text-sm whitespace-pre-wrap break-words bg-gray-50 p-2 rounded">
              {JSON.stringify(response.result, null, 2)}
            </pre>
          ) : (
            <pre className="text-sm whitespace-pre-wrap break-words bg-red-50 text-red-700 border border-red-300 p-2 rounded font-bold">
              {response.error}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
