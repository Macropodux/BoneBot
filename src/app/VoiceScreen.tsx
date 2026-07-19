"use client";

// BoneBot — voice-led conversational intake screen.
//
// Talks to /api/converse (LLM-led intake: the LLM only extracts/phrases, the
// deterministic gates/triage/assembly logic in src/lib/intake-fields.ts
// decides everything else — see that route's header comment). This screen
// is additive: it never touches the existing scripted STEPS chat in
// page.tsx. confirmMode is always on here (per the voice-input spec: replies
// are transcribed and error-prone, so every captured value gets a spoken-
// back yes/no before it's accepted).
//
// Mic input uses the Web Speech API (SpeechRecognition). Not implemented in
// every browser (notably: no Firefox support as of this writing) — the mic
// button is simply omitted when unavailable, and typing always works.

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, MotionConfig, useReducedMotion } from "framer-motion";
import { THEME, HEADING_FONT, BODY_FONT } from "@/lib/editorial-theme";
import type { ModelOutput } from "@/lib/bone-model";
import type { Report } from "@/lib/bone-schema";
import type { EvidenceSource } from "@/lib/bone-evidence";

type ConverseMessage = { role: "user" | "assistant"; content: string };
type FieldInputType = "text" | "boolean" | "number" | "choice" | "image";

type ConverseResponse = {
  reply: string;
  field: string | null;
  inputType: FieldInputType | null;
  options?: string[];
  collected: Record<string, unknown>;
  gateExit?: { message: string };
  triageStop?: { message: string; triage: { probabilityPercent: number; thresholdPercent: number; validated: boolean } };
  readyToScore: boolean;
  features?: Record<string, unknown> | null;
  awaitingConfirm?: boolean;
};

type ScreenResult = { model: ModelOutput; report: Report | null; evidence: EvidenceSource[] };

type ChatBubble = { role: "bot" | "user"; text: string };

const CAT_META = {
  lower: { label: "Low risk", color: THEME.accent, bg: "#E1F0EC" },
  uncertain: { label: "Moderate risk", color: "#A06D14", bg: "#FBF3DD" },
  elevated: { label: "Elevated risk", color: "#B0442F", bg: "#F9E7E2" },
} as const;

// Minimal, browser-vendor-agnostic Web Speech API surface — not in every
// TS DOM lib target, so accessed via a narrow local type instead of `any`.
type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

function getSpeechRecognition(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  const ctor = (w.SpeechRecognition ?? w.webkitSpeechRecognition) as (new () => SpeechRecognitionLike) | undefined;
  return ctor ?? null;
}

async function converseTurn(
  messages: ConverseMessage[],
  collected: Record<string, unknown>,
  awaitingConfirm: boolean,
): Promise<ConverseResponse> {
  const response = await fetch("/api/converse", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ messages, collected, confirmMode: true, awaitingConfirm }),
  });
  if (!response.ok) throw new Error("BoneBot's voice screening is unavailable right now.");
  return (await response.json()) as ConverseResponse;
}

export default function VoiceScreen({ onExit }: { onExit: () => void }) {
  const reduceMotion = Boolean(useReducedMotion());
  const [history, setHistory] = useState<ConverseMessage[]>([]);
  const [bubbles, setBubbles] = useState<ChatBubble[]>([]);
  const [collected, setCollected] = useState<Record<string, unknown>>({});
  const [awaitingConfirm, setAwaitingConfirm] = useState(false);
  const [inputType, setInputType] = useState<FieldInputType | null>(null);
  const [options, setOptions] = useState<string[]>([]);
  const [busy, setBusy] = useState(true);
  const [textInput, setTextInput] = useState("");
  const [listening, setListening] = useState(false);
  const [micSupported] = useState(() => getSpeechRecognition() !== null);
  const [terminal, setTerminal] = useState<{ kind: "gateExit" | "triageStop"; message: string; probabilityPercent?: number } | null>(null);
  const [result, setResult] = useState<ScreenResult | null>(null);
  const [error, setError] = useState("");

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [bubbles, busy]);

  // Kick off the conversation once on mount — an empty first turn produces
  // BoneBot's greeting + first question, same contract as any other turn.
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void applyTurn([], {}, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function applyTurn(nextHistory: ConverseMessage[], nextCollected: Record<string, unknown>, nextAwaitingConfirm: boolean) {
    setBusy(true);
    setError("");
    try {
      const response = await converseTurn(nextHistory, nextCollected, nextAwaitingConfirm);
      setCollected(response.collected);
      setHistory([...nextHistory, { role: "assistant", content: response.reply }]);
      setBubbles((b) => [...b, { role: "bot", text: response.reply }]);

      if (response.gateExit) {
        setTerminal({ kind: "gateExit", message: response.gateExit.message });
        setInputType(null);
        setAwaitingConfirm(false);
        return;
      }
      if (response.triageStop) {
        setTerminal({ kind: "triageStop", message: response.triageStop.message, probabilityPercent: response.triageStop.triage.probabilityPercent });
        setInputType(null);
        setAwaitingConfirm(false);
        return;
      }
      if (response.readyToScore && response.features) {
        await scoreAndShowResult(response.features);
        return;
      }

      setInputType(response.inputType);
      setOptions(response.options ?? []);
      setAwaitingConfirm(response.awaitingConfirm === true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "BoneBot's voice screening is unavailable right now.");
    } finally {
      setBusy(false);
    }
  }

  async function scoreAndShowResult(features: Record<string, unknown>) {
    try {
      const response = await fetch("/api/screen", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(features),
      });
      if (!response.ok) throw new Error("Could not create the screening result.");
      setResult((await response.json()) as ScreenResult);
    } catch {
      setError("BoneBot calculated your answers but could not load the result. Please try again.");
    }
  }

  function submit(rawText: string) {
    const text = rawText.trim();
    if (!text || busy) return;
    setBubbles((b) => [...b, { role: "user", text }]);
    setTextInput("");
    const nextHistory: ConverseMessage[] = [...history, { role: "user", content: text }];
    void applyTurn(nextHistory, collected, awaitingConfirm);
  }

  function startListening() {
    const Recognition = getSpeechRecognition();
    if (!Recognition || busy) return;
    const recognition = new Recognition();
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript ?? "";
      if (transcript.trim()) submit(transcript);
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  }

  function stopListening() {
    recognitionRef.current?.stop();
    setListening(false);
  }

  function restart() {
    setHistory([]);
    setBubbles([]);
    setCollected({});
    setAwaitingConfirm(false);
    setInputType(null);
    setOptions([]);
    setBusy(true);
    setTextInput("");
    setTerminal(null);
    setResult(null);
    setError("");
    void applyTurn([], {}, false);
  }

  const showFreeText = !busy && !terminal && !result && (inputType === "text" || inputType === "number");
  const showOptions = !busy && !terminal && !result && (inputType === "boolean" || inputType === "choice") && options.length > 0;
  const cat = result ? (result.model.category === "lower" ? "lower" : result.model.category === "elevated" ? "elevated" : "uncertain") : "lower";
  const catMeta = CAT_META[cat];

  return (
    <MotionConfig reducedMotion="user">
      <div className={`flex flex-1 flex-col overflow-hidden ${BODY_FONT} text-[16px] leading-[1.6]`} style={{ backgroundColor: THEME.bg, color: THEME.bodyPrimary }}>
        <header className="flex flex-wrap items-center gap-5 px-5 py-[18px] sm:px-16" style={{ borderBottom: `1px solid ${THEME.border}` }}>
          <button onClick={onExit} className={`${HEADING_FONT} text-[22px] font-semibold tracking-[-0.01em]`} style={{ color: THEME.ink }}>
            BoneBot
          </button>
          <div className="text-[13px] font-semibold uppercase tracking-[0.14em]" style={{ color: THEME.muted }}>
            Voice screening
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="rounded-full px-3 py-[5px] text-xs font-semibold" style={{ backgroundColor: "#FBF3DD", color: "#8A6A1F" }}>
              Screening flag, not a diagnosis
            </div>
            <button
              onClick={restart}
              className="rounded-full border-[1.5px] px-3.5 py-[7px] text-[13px] font-semibold transition-colors"
              style={{ borderColor: THEME.borderSecondary, color: THEME.body }}
            >
              Start over
            </button>
          </div>
        </header>

        {!result && (
          <div ref={chatRef} className="flex-1 overflow-y-auto px-6 py-8">
            <div className="mx-auto flex max-w-[680px] flex-col gap-3.5">
              <AnimatePresence initial={false}>
                {bubbles.map((m, i) => (
                  <motion.div
                    key={i}
                    initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25 }}
                    className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className="max-w-[82%] whitespace-pre-wrap px-4 py-3 text-[16px] leading-[1.55]"
                      style={
                        m.role === "user"
                          ? { backgroundColor: THEME.accent, color: THEME.bg, borderRadius: "14px 14px 4px 14px" }
                          : { backgroundColor: "#FFFFFF", border: `1px solid ${THEME.border}`, borderRadius: "14px 14px 14px 4px" }
                      }
                    >
                      {m.text}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {busy && (
                <div className="flex justify-start">
                  <div className="flex gap-[5px] rounded-[14px_14px_14px_4px] px-4 py-3.5" style={{ backgroundColor: "#FFFFFF", border: `1px solid ${THEME.border}` }}>
                    {[0, 0.2, 0.4].map((delay) => (
                      <span key={delay} className="h-[7px] w-[7px] animate-[bw-blink_1.2s_infinite] rounded-full" style={{ backgroundColor: THEME.accent, animationDelay: `${delay}s` }} />
                    ))}
                  </div>
                </div>
              )}
              {error && <p className="rounded-[10px] px-4 py-3 text-sm" style={{ backgroundColor: "#F9E7E2", color: "#B0442F" }}>{error}</p>}

              {terminal && (
                <div className="mt-2 rounded-2xl px-6 py-6" style={{ border: `1px solid ${THEME.border}`, backgroundColor: "#FFFFFF" }}>
                  {terminal.kind === "triageStop" && terminal.probabilityPercent !== undefined && (
                    <div className={`${HEADING_FONT} mb-2 text-[40px] font-semibold`} style={{ color: THEME.accent }}>
                      {terminal.probabilityPercent}%
                    </div>
                  )}
                  <p style={{ color: THEME.body }}>{terminal.message}</p>
                  <button
                    onClick={restart}
                    className={`${HEADING_FONT} mt-4 inline-flex min-h-[44px] items-center justify-center rounded-full px-6 text-[15px] font-semibold text-white`}
                    style={{ backgroundColor: THEME.accent }}
                  >
                    Start over
                  </button>
                </div>
              )}

              {showOptions && (
                <div className="flex flex-wrap justify-end gap-2.5">
                  {options.map((opt) => (
                    <button
                      key={opt}
                      onClick={() => submit(opt)}
                      className="inline-flex min-h-[44px] items-center rounded-full border-[1.5px] px-5 text-[15px] font-semibold transition-colors"
                      style={{ borderColor: THEME.accent, color: THEME.accent }}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {result && (
          <div className="flex-1 overflow-y-auto px-6 py-8">
            <div className="mx-auto flex max-w-[680px] flex-col gap-5">
              <div className="rounded-2xl px-7 py-7" style={{ border: `1px solid ${THEME.border}`, backgroundColor: "#FFFFFF" }}>
                <div className="mb-4 flex flex-wrap items-center gap-4">
                  <div className={`${HEADING_FONT} text-[40px] font-semibold`} style={{ color: catMeta.color }}>
                    {catMeta.label}
                  </div>
                  <div className="rounded-full px-3.5 py-1.5 text-[13px] font-semibold" style={{ color: catMeta.color, backgroundColor: catMeta.bg }}>
                    Estimated T-score {result.model.estimatedTScore}
                  </div>
                </div>
                <p style={{ color: THEME.body }}>
                  {result.report?.summary ?? `Your estimated T-score is ${result.model.estimatedTScore}, range ${result.model.tScoreRange[0]} to ${result.model.tScoreRange[1]}. This is a screening estimate, not a diagnosis.`}
                </p>
              </div>

              {result.report && (
                <div className="rounded-2xl px-7 py-7" style={{ border: `1px solid ${THEME.border}`, backgroundColor: "#FFFFFF" }}>
                  <div className={`${HEADING_FONT} mb-3 text-[15px] font-semibold`} style={{ color: THEME.ink }}>
                    What drove this result
                  </div>
                  <ul className="flex flex-col gap-3">
                    {result.report.factorExplanations.map((item, i) => (
                      <li key={`${item.factor}-${i}`} style={{ borderLeft: `2px solid ${THEME.border}`, paddingLeft: "14px" }}>
                        <p className="font-semibold" style={{ color: THEME.ink }}>{item.factor}</p>
                        <p className="text-[14px]" style={{ color: THEME.body }}>{item.plain}</p>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-4 rounded-xl px-4 py-4" style={{ backgroundColor: THEME.bandBg }}>
                    <p className="text-[13px] font-semibold" style={{ color: THEME.accent }}>What you can change</p>
                    <p className="mt-1 text-[14px]" style={{ color: THEME.body }}>{result.report.modifiableGuidance}</p>
                  </div>
                  <p className="mt-4 text-[14px]" style={{ color: THEME.body }}>{result.report.recommendation}</p>
                </div>
              )}

              <p className="text-[13px]" style={{ color: THEME.muted }}>
                This is a screening tool, not a diagnosis. A DXA scan and your clinician confirm bone health.
              </p>
              <button
                onClick={restart}
                className={`${HEADING_FONT} self-start inline-flex min-h-[48px] items-center justify-center rounded-full px-6 text-[16px] font-semibold text-white`}
                style={{ backgroundColor: THEME.accent }}
              >
                Start over
              </button>
            </div>
          </div>
        )}

        {(showFreeText || (showOptions && micSupported)) && (
          <div className="px-6 py-5" style={{ borderTop: `1px solid ${THEME.border}`, backgroundColor: "#FFFFFF" }}>
            <div className="mx-auto flex max-w-[680px] flex-col gap-2.5">
              {showFreeText && (
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    submit(textInput);
                  }}
                  className="flex gap-2 rounded-[12px] p-1.5"
                  style={{ border: `1.5px solid ${THEME.borderInput}`, backgroundColor: THEME.bg }}
                >
                  <input
                    autoFocus
                    type={inputType === "number" ? "number" : "text"}
                    value={textInput}
                    onChange={(event) => setTextInput(event.target.value)}
                    placeholder={listening ? "Listening…" : "Type your answer, or tap the mic"}
                    disabled={listening}
                    className="flex-1 border-0 bg-transparent px-2.5 py-2 text-[15px] outline-none disabled:opacity-60"
                  />
                  {micSupported && (
                    <button
                      type="button"
                      onClick={listening ? stopListening : startListening}
                      aria-label={listening ? "Stop listening" : "Speak your answer"}
                      className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-white transition-colors"
                      style={{ backgroundColor: listening ? "#B0442F" : THEME.accent }}
                    >
                      🎙
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={!textInput.trim()}
                    className={`${HEADING_FONT} flex-shrink-0 rounded-[9px] px-4 py-2 text-[14px] font-semibold text-white disabled:opacity-40`}
                    style={{ backgroundColor: THEME.accent }}
                  >
                    Send
                  </button>
                </form>
              )}
              {showOptions && micSupported && (
                <button
                  type="button"
                  onClick={listening ? stopListening : startListening}
                  className="flex items-center justify-center gap-2 self-center rounded-full px-4 py-2 text-[13px] font-semibold text-white transition-colors"
                  style={{ backgroundColor: listening ? "#B0442F" : THEME.accent }}
                >
                  🎙 {listening ? "Listening… tap to stop" : "Or answer by voice"}
                </button>
              )}
              <p className="text-center text-[12px]" style={{ color: THEME.muted }}>
                BoneBot is a screening flag, not a diagnosis. Voice answers are read back before they&apos;re used.
              </p>
            </div>
          </div>
        )}
      </div>
    </MotionConfig>
  );
}
