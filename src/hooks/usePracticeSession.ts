import { useCallback, useEffect, useRef, useState } from "react";
import { StreamingTranscriber } from "assemblyai/streaming";
import { callInterviewLLM, fetchStreamingToken } from "../lib/edge";
import {
  acquireMicStream,
  startMicCapture,
  type MicCaptureHandle,
} from "../lib/audioCapture";
import { analyzeAnswerForCoaching, type CoachingTip } from "../lib/coaching";
import {
  computeObservableStats,
  fallbackReport,
  type QaPair,
  type SessionReport,
} from "../lib/report";
import { cancelSpeech, speakText } from "../lib/speech";

/**
 * Connection lifecycle:
 *  - `idle`       — not connected (start screen).
 *  - `connecting` — handshake in progress (microphone → token → WebSocket).
 *  - `live`       — connected and streaming audio.
 *  - `stopped`    — disconnected by the user; the transcript is kept.
 *  - `ended`      — session finished.
 * Failures surface through the `error` banner while the status settles to
 * `idle` (couldn't connect) or `stopped` (connection dropped mid-session), so
 * a dropped session never silently discards the transcript on screen.
 */
export type SessionStatus = "idle" | "connecting" | "live" | "stopped" | "ended";

export type TranscriptTurn = {
  id: string;
  /** Assigned by the transcription service: "A", "B", … or null when unknown. */
  speaker: string | null;
  text: string;
  /** When the turn was finalised, epoch ms. */
  at: number;
};

export type SessionError = { title: string; message: string };

// ---------------------------------------------------------------------------
// Interview model
// ---------------------------------------------------------------------------

export const MAX_QUESTIONS = 5;

export const ROLES = [
  { id: "software", label: "Software Engineering" },
  { id: "product", label: "Product Management" },
  { id: "data", label: "Data Science" },
  { id: "behavioral", label: "Behavioral & Leadership" },
] as const;

export type RoleId = (typeof ROLES)[number]["id"];

export type InterviewPhase =
  | "idle" // no interview started
  | "starting" // connection up, AI generating its greeting
  | "ai_speaking" // AI question on screen (Speaking state)
  | "listening" // waiting for the candidate's answer
  | "thinking" // AI generating the next question
  | "wrapped" // interview complete — end session for the report
  | "error"; // an AI call failed; retry is available

export type InterviewLogTurn = { role: "interviewer" | "user"; text: string; at: number };

export type InterviewState = {
  phase: InterviewPhase;
  roleId: RoleId;
  roleLabel: string;
  /** Current question, 1-based (0 before the first question arrives). */
  questionNumber: number;
  totalQuestions: number;
  currentQuestion: string;
  /** Accumulated transcript of the answer currently being given. */
  currentAnswer: string;
  coaching: CoachingTip[];
  history: QaPair[];
  log: InterviewLogTurn[];
  durationSec: number;
  aiError: string | null;
};

export type ReportStatus = "idle" | "generating" | "ready" | "error";

const MAX_TURNS = 500;
const SAMPLE_RATE = 16000;

/**
 * The AssemblyAI SDK pins its connect budget to 1000 ms by default — too tight
 * for the first handshake on a real network, where DNS + TLS + the server's
 * `Begin` frame routinely take longer. Give the handshake a realistic budget
 * and allow one retry on transient failures; permanent errors (auth, billing)
 * are never retried by the SDK, and the connecting card exposes a Cancel
 * button so the worst-case wait can always be aborted.
 */
const CONNECT_TIMEOUT_MS = 15_000;
const MAX_CONNECTION_RETRIES = 1;
const CONNECTION_RETRY_DELAY_MS = 750;

/** Silence (in ms) after the last finalized turn that marks the answer complete. */
const ANSWER_SILENCE_MS = 4_500;
/** Hard cap so an answer can't run forever. */
const MAX_ANSWER_WORDS = 240;
/** First LLM coaching call once the answer reaches this length (chars). */
const COACHING_MIN_CHARS = 70;
/** Subsequent LLM coaching calls at least this many new chars apart. */
const COACHING_DELTA_CHARS = 160;
const LLM_TIMEOUT_MS = 30_000;
const REPORT_TIMEOUT_MS = 45_000;
/** Safety cap for the AI "Speaking" state if TTS end callbacks never fire. */
const AI_SPEAK_MAX_MS = 12_000;

/** Synthetic speaker tag for interviewer turns injected into the transcript. */
const AI_SPEAKER = "__interviewer__";

type InterviewRuntime = {
  phase: InterviewPhase;
  roleId: RoleId;
  questionNumber: number;
  currentQuestion: string;
  currentAnswer: string;
  coaching: CoachingTip[];
  history: QaPair[];
  log: InterviewLogTurn[];
  durationSec: number;
  aiError: string | null;
  startedAt: number | null;
  lastActivityAt: number;
  lastCoachingLen: number;
  llmBusy: boolean;
  nudgeCount: number;
  silenceTimer: ReturnType<typeof setTimeout> | null;
  deliveryTimer: ReturnType<typeof setTimeout> | null;
  pendingAi: "first" | "followup" | null;
  wrapped: boolean;
};

function freshRuntime(roleId: RoleId): InterviewRuntime {
  const role = ROLES.find((r) => r.id === roleId) ?? ROLES[0];
  return {
    phase: "idle",
    roleId: role.id,
    questionNumber: 0,
    currentQuestion: "",
    currentAnswer: "",
    coaching: [],
    history: [],
    log: [],
    durationSec: 0,
    aiError: null,
    startedAt: null,
    lastActivityAt: 0,
    lastCoachingLen: 0,
    llmBusy: false,
    nudgeCount: 0,
    silenceTimer: null,
    deliveryTimer: null,
    pendingAi: null,
    wrapped: false,
  };
}

function toInterviewState(r: InterviewRuntime): InterviewState {
  const role = ROLES.find((x) => x.id === r.roleId) ?? ROLES[0];
  return {
    phase: r.phase,
    roleId: r.roleId,
    roleLabel: role.label,
    questionNumber: r.questionNumber,
    totalQuestions: MAX_QUESTIONS,
    currentQuestion: r.currentQuestion,
    currentAnswer: r.currentAnswer,
    coaching: r.coaching,
    history: r.history,
    log: r.log,
    durationSec: r.durationSec,
    aiError: r.aiError,
  };
}

function parseReport(data: Record<string, unknown>): SessionReport {
  const num = (value: unknown, dflt = 70): number => {
    if (typeof value === "number" && Number.isFinite(value)) {
      return Math.max(0, Math.min(100, Math.round(value)));
    }
    return dflt;
  };
  const list = (value: unknown, dflt: string[]): string[] =>
    Array.isArray(value)
      ? value.filter((x): x is string => typeof x === "string" && x.trim().length > 0).slice(0, 5)
      : dflt;

  return {
    score: num(data.score, 72),
    communication: num(data.communication),
    relevance: num(data.relevance),
    clarity: num(data.clarity),
    confidence: num(data.confidence),
    technical: num(data.technical),
    summary:
      typeof data.summary === "string" && data.summary.trim()
        ? data.summary.trim()
        : "Here's how your practice session went.",
    strengths: list(data.strengths, ["You completed a practice session."]),
    improvements: list(data.improvements, [
      "Review the transcript and pick one thing to improve next time.",
    ]),
    recommendations: list(data.recommendations, [
      "Practice this role again and compare your score.",
    ]),
    weakAnswerExample:
      typeof data.weakAnswerExample === "string" && data.weakAnswerExample.trim()
        ? data.weakAnswerExample.trim()
        : "",
  };
}

let turnId = 0;

/** Minimal structural views of SDK events (keeps the SDK types decoupled here). */
type OpenMessage = { id?: string };
type TurnMessage = { transcript?: string; speaker_label?: string | null };
type ErrorLike = { error?: unknown; message?: unknown };

/**
 * Typing gap in assemblyai ^4.41: the `StreamingTranscriber.on()` overloads omit
 * the "speechStarted" event name even though the runtime dispatches it — on a
 * server `SpeechStarted` frame it calls `this.listeners.speechStarted?.(message)`
 * (see the streaming runtime in `node_modules/assemblyai/dist`). This wrapper
 * types that single event precisely instead of falling back to an `any` cast.
 */
function onSpeechStarted(transcriber: StreamingTranscriber, listener: () => void): void {
  (transcriber.on as unknown as (
    event: "speechStarted",
    listener: () => void,
  ) => void)("speechStarted", listener);
}

/** Human-readable explanations for AssemblyAI v3 streaming close/error codes. */
const STREAMING_CODE_MESSAGES: Record<number, string> = {
  4000: "The audio sample rate for this session isn't supported.",
  4001: "The secure session token was rejected. Please try again in a moment.",
  4002: "Live transcription has run out of credits on the AssemblyAI account.",
  4003: "Live transcription requires a paid AssemblyAI plan for this app.",
  4004: "The transcription session no longer exists.",
  4008: "The live session expired. Start a new practice.",
  4029: "AssemblyAI is rate-limiting connections right now. Wait a few seconds and try again.",
  4030: "Another tab is using the same transcription session. Close duplicate tabs and retry.",
  4031: "The session timed out on AssemblyAI's side.",
  4102: "Too many live transcription sessions are open right now. Close others and retry.",
  3008: "This practice session reached its maximum allowed length.",
};

/** Maps every failure the connect flow can hit to copy a user can act on. */
function describeError(err: unknown): SessionError {
  const e = (err ?? {}) as { name?: string; message?: string; code?: number };
  const name = e.name ?? "";
  const message = typeof e.message === "string" ? e.message : "";
  const lower = message.toLowerCase();

  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return {
      title: "Microphone access needed",
      message:
        "Allow microphone access in your browser to start practice. Audio is used only for live transcription.",
    };
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return {
      title: "No microphone found",
      message: "Plug in a microphone, make sure it isn't in use by another app, then try again.",
    };
  }
  if (lower.includes("timed out")) {
    return {
      title: "Couldn't connect to live transcription",
      message:
        "The connection to the transcription service took too long. Check your internet connection and try again.",
    };
  }
  if (
    lower.includes("not authorized") ||
    lower.includes("unauthorized") ||
    lower.includes("secret is not configured")
  ) {
    return {
      title: "Live transcription isn't ready",
      message:
        "The transcription service rejected the connection. Try again — if this keeps happening, the app owner needs to check the AssemblyAI key.",
    };
  }
  if (
    lower.includes("insufficient funds") ||
    lower.includes("free tier") ||
    lower.includes("paid plan")
  ) {
    return {
      title: "Live transcription needs the paid plan",
      message:
        "The AssemblyAI account behind this app needs credits or a payment method for live transcription.",
    };
  }
  if (typeof e.code === "number" && STREAMING_CODE_MESSAGES[e.code]) {
    return { title: "Connection refused", message: STREAMING_CODE_MESSAGES[e.code] };
  }
  if (lower.includes("failed (status") || lower.includes("request to")) {
    return {
      title: "Couldn't reach the session service",
      message: "A secure session couldn't be started. Please try again.",
    };
  }
  const detail = message.trim() ? message : "Something went wrong while connecting. Please try again.";
  return { title: "Couldn't start the session", message: detail };
}

export function usePracticeSession() {
  const [status, setStatus] = useState<SessionStatus>("idle");
  const [turns, setTurns] = useState<TranscriptTurn[]>([]);
  const [speaking, setSpeaking] = useState(false);
  const [level, setLevel] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<SessionError | null>(null);
  const [interview, setInterview] = useState<InterviewState>(() => toInterviewState(freshRuntime("software")));
  const [reportStatus, setReportStatus] = useState<ReportStatus>("idle");
  const [report, setReport] = useState<SessionReport | null>(null);

  const transcriberRef = useRef<StreamingTranscriber | null>(null);
  const captureRef = useRef<MicCaptureHandle | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const runningRef = useRef(false);
  /** True once the server sent `Begin` — lets us skip the flush wait when the session never started. */
  const beganRef = useRef(false);
  const statusRef = useRef<SessionStatus>("idle");

  /** Mutable interview state — single source of truth for async logic. */
  const iv = useRef<InterviewRuntime>(freshRuntime("software"));
  /** Full transcript text for the report (independent of the trimmed UI list). */
  const transcriptLogRef = useRef<string[]>([]);
  /** True while the browser TTS is reading an interviewer question. */
  const ttsActiveRef = useRef(false);

  /** Keeps the status ref and state in lockstep so async callbacks never read a stale value. */
  const setBoth = useCallback((next: SessionStatus) => {
    statusRef.current = next;
    setStatus(next);
  }, []);

  // -------------------------------------------------------------------------
  // Interview internals (function declarations: hoisted, closures over refs)
  // -------------------------------------------------------------------------

  function syncInterview() {
    setInterview(toInterviewState(iv.current));
  }

  function clearTimers() {
    if (iv.current.silenceTimer) {
      clearTimeout(iv.current.silenceTimer);
      iv.current.silenceTimer = null;
    }
    if (iv.current.deliveryTimer) {
      clearTimeout(iv.current.deliveryTimer);
      iv.current.deliveryTimer = null;
    }
  }

  function addLog(role: "interviewer" | "user", text: string) {
    const clean = text.trim();
    if (!clean) return;
    iv.current.log.push({ role, text: clean, at: Date.now() });
  }

  /** Silently no-ops outside the `listening` phase; idempotent via phase check. */
  function armSilenceTimer() {
    if (iv.current.silenceTimer) clearTimeout(iv.current.silenceTimer);
    iv.current.silenceTimer = setTimeout(() => {
      iv.current.silenceTimer = null;
      if (iv.current.phase !== "listening") return;
      if (Date.now() - iv.current.lastActivityAt < ANSWER_SILENCE_MS - 400) return;
      finalizeAnswer();
    }, ANSWER_SILENCE_MS);
  }

  function handleAiFailure(message: string, pending: "first" | "followup") {
    if (!runningRef.current) return;
    iv.current.phase = "error";
    iv.current.aiError = message;
    iv.current.pendingAi = pending;
    iv.current.llmBusy = false;
    cancelSpeech();
    ttsActiveRef.current = false;
    clearTimers();
    syncInterview();
  }

  /** Shows the question on screen, speaks it (best-effort), then opens listening. */
  function deliverQuestion(question: string) {
    iv.current.questionNumber += 1;
    iv.current.currentQuestion = question;
    iv.current.currentAnswer = "";
    iv.current.lastCoachingLen = 0;
    iv.current.nudgeCount = 0;
    iv.current.coaching = [];
    iv.current.aiError = null;
    iv.current.pendingAi = null;
    iv.current.phase = "ai_speaking";
    addLog("interviewer", question);
    appendTurn(AI_SPEAKER, question);
    syncInterview();

    const finishSpeaking = () => {
      if (iv.current.phase !== "ai_speaking") return;
      iv.current.phase = "listening";
      syncInterview();
      armSilenceTimer();
    };

    const ttsAvailable = typeof window !== "undefined" && "speechSynthesis" in window;
    if (ttsAvailable) {
      ttsActiveRef.current = true;
      speakText(question, () => {
        ttsActiveRef.current = false;
        finishSpeaking();
      });
    } else {
      finishSpeaking();
    }

    // Safety net: never leave the user stuck in "Speaking" if TTS callbacks miss.
    if (iv.current.deliveryTimer) clearTimeout(iv.current.deliveryTimer);
    iv.current.deliveryTimer = setTimeout(() => {
      iv.current.deliveryTimer = null;
      ttsActiveRef.current = false;
      finishSpeaking();
    }, ttsAvailable ? AI_SPEAK_MAX_MS : 600);
  }

  /** Rule-based tips instantly + one throttled LLM coaching call per chunk. */
  function requestCoaching() {
    const answer = iv.current.currentAnswer;
    const ruleTips = analyzeAnswerForCoaching(answer);
    if (ruleTips.length > 0) {
      iv.current.coaching = ruleTips;
      syncInterview();
    }
    if (iv.current.llmBusy) return;
    if (answer.length < COACHING_MIN_CHARS) return;
    if (answer.length - iv.current.lastCoachingLen < COACHING_DELTA_CHARS) return;
    iv.current.lastCoachingLen = answer.length;
    iv.current.llmBusy = true;
    const question = iv.current.currentQuestion;

    void (async () => {
      try {
        const res = await callInterviewLLM(
          {
            system:
              "You are a concise live interview coach. Based on the interview question and the candidate's answer so far, give up to 3 short, specific, actionable tips (max 9 words each). If the answer is going well, acknowledge that.",
            conversation: [
              {
                role: "user",
                text: `Interview question:\n${question}\n\nCandidate's answer so far:\n${answer}\n\nReply with STRICT JSON only: {"tips": ["...", "..."]}`,
              },
            ],
            json: true,
            temperature: 0.4,
          },
          LLM_TIMEOUT_MS,
        );
        const data = res.data ?? {};
        const tips = Array.isArray(data.tips)
          ? data.tips
              .filter((t): t is string => typeof t === "string" && t.trim().length > 0)
              .slice(0, 3)
          : [];
        if (tips.length > 0) {
          iv.current.coaching = tips.map((t, i) => ({
            id: `ai-${i}`,
            text: t.trim(),
            tone: "attention" as const,
          }));
          syncInterview();
        }
      } catch {
        // Rule-based tips are already on screen — the AI coach is best-effort.
      } finally {
        iv.current.llmBusy = false;
      }
    })();
  }

  /** Called when the candidate's answer is judged complete (silence or manual). */
  function finalizeAnswer() {
    if (!runningRef.current) return;
    if (iv.current.phase !== "listening") return;
    if (iv.current.llmBusy) return;

    const answer = iv.current.currentAnswer.trim();
    if (!answer && iv.current.nudgeCount < 1) {
      iv.current.nudgeCount += 1;
      const nudge =
        "No worries — take your time. I'm listening whenever you're ready.";
      addLog("interviewer", nudge);
      appendTurn(AI_SPEAKER, nudge);
      syncInterview();
      armSilenceTimer();
      return;
    }

    clearTimers();
    cancelSpeech();
    ttsActiveRef.current = false;
    const question = iv.current.currentQuestion;
    iv.current.history.push({ question, answer });
    if (answer) addLog("user", answer);
    iv.current.currentAnswer = "";

    if (iv.current.history.length >= MAX_QUESTIONS) {
      iv.current.wrapped = true;
      iv.current.phase = "wrapped";
      const wrap = "That's a wrap — great work. Click “End session” to get your full report and score.";
      addLog("interviewer", wrap);
      appendTurn(AI_SPEAKER, wrap);
      syncInterview();
      return;
    }

    iv.current.phase = "thinking";
    syncInterview();
    followUpQuestion(question, answer);
  }

  function followUpQuestion(currentQuestion: string, currentAnswer: string) {
    if (!runningRef.current) return;
    iv.current.pendingAi = "followup";
    const role = ROLES.find((r) => r.id === iv.current.roleId) ?? ROLES[0];
    const historyLines =
      iv.current.history.length === 0
        ? "(none yet)"
        : iv.current.history.map((h, i) => `Q${i + 1}: ${h.question}\nA: ${h.answer}`).join("\n\n");

    void (async () => {
      try {
        const res = await callInterviewLLM(
          {
            system:
              "You are a professional AI interviewer. Keep the mock interview moving naturally. Your next question must build on what the candidate just said, probe deeper (ask for specifics, a second example, what they'd do differently, or a harder variant), get progressively more challenging, and never repeat an earlier question.",
            conversation: [
              {
                role: "user",
                text: `Role: ${role.label}\n\nConversation so far:\n${historyLines}\n\nCurrent question:\n${currentQuestion}\n\nCandidate's answer:\n${currentAnswer}\n\nAsk the next interview question. One question only, no greeting, max ~35 words. If the answer was empty, nudge them to try again or offer to move on.\nReply with STRICT JSON only: {"question": "..."}`,
              },
            ],
            json: true,
            temperature: 0.7,
          },
          LLM_TIMEOUT_MS,
        );
        const data = res.data ?? {};
        const question = typeof data.question === "string" ? data.question.trim() : "";
        if (!question) throw new Error("The interviewer returned an empty question.");
        deliverQuestion(question);
      } catch {
        handleAiFailure(
          "I had trouble thinking of the next question. Retry to continue the interview.",
          "followup",
        );
      }
    })();
  }

  /** Fires right after the streaming connection is established (server `Begin`). */
  function beginInterview() {
    if (!runningRef.current) return;
    if (iv.current.phase !== "idle" && iv.current.phase !== "starting") return;
    iv.current.phase = "starting";
    iv.current.startedAt ??= Date.now();
    iv.current.aiError = null;
    iv.current.pendingAi = "first";
    syncInterview();

    const role = ROLES.find((r) => r.id === iv.current.roleId) ?? ROLES[0];
    void (async () => {
      try {
        const res = await callInterviewLLM(
          {
            system:
              "You are a friendly, professional AI interviewer running a mock job interview. Speak warmly and naturally, like a real interviewer.",
            conversation: [
              {
                role: "user",
                text: `You are interviewing a candidate for a ${role.label} role. Greet them and ask the FIRST interview question.\nRules:\n- Start with a one-sentence greeting that introduces you as the interviewer.\n- Then ask exactly one open-ended interview question relevant to a ${role.label} role (behavioral or technical, typical first round).\n- Make it specific and answerable in under two minutes.\n- Reply with STRICT JSON only: {"greeting": "...", "question": "..."}`,
              },
            ],
            json: true,
            temperature: 0.7,
          },
          LLM_TIMEOUT_MS,
        );
        const data = res.data ?? {};
        const greeting = typeof data.greeting === "string" ? data.greeting.trim() : "";
        const question = typeof data.question === "string" ? data.question.trim() : "";
        if (!question) throw new Error("The interviewer didn't produce a question.");
        if (greeting) {
          addLog("interviewer", greeting);
          appendTurn(AI_SPEAKER, greeting);
          syncInterview();
        }
        deliverQuestion(question);
      } catch {
        handleAiFailure(
          "I couldn't start the interview. Check your connection and retry.",
          "first",
        );
      }
    })();
  }

  /** Routes every finalized STT turn into the interview state machine. */
  function handleFinalTurn(text: string) {
    if (!runningRef.current) return;
    if (iv.current.phase === "thinking" || iv.current.phase === "starting") return;
    if (iv.current.phase === "ai_speaking") {
      // Likely the interviewer's own TTS echoing into the mic — ignore it and
      // let the delivery timer (or TTS end) open listening.
      if (ttsActiveRef.current) return;
      if (iv.current.deliveryTimer) {
        clearTimeout(iv.current.deliveryTimer);
        iv.current.deliveryTimer = null;
      }
      iv.current.phase = "listening";
    }
    iv.current.lastActivityAt = Date.now();
    if (iv.current.phase === "listening") {
      iv.current.currentAnswer = `${iv.current.currentAnswer} ${text}`.trim();
      syncInterview();
      requestCoaching();
      if (iv.current.currentAnswer.trim().split(/\s+/).length >= MAX_ANSWER_WORDS) {
        finalizeAnswer();
        return;
      }
    }
    armSilenceTimer();
  }

  function generateReport() {
    const role = ROLES.find((r) => r.id === iv.current.roleId) ?? ROLES[0];
    const transcriptText = transcriptLogRef.current.join(" ");
    const qaHistory = iv.current.history;
    const durationSec = iv.current.durationSec;
    const stats = computeObservableStats(transcriptText, qaHistory, durationSec);
    setReportStatus("generating");

    if (qaHistory.length === 0 && stats.totalWords === 0) {
      setReportStatus("error");
      setReport(null);
      return;
    }

    const minutes = Math.floor(durationSec / 60);
    const seconds = durationSec % 60;
    const historyBlock =
      qaHistory.length === 0
        ? "No complete question/answer pairs were captured."
        : qaHistory.map((h, i) => `Q${i + 1}: ${h.question}\nA: ${h.answer}`).join("\n\n");

    void (async () => {
      try {
        const res = await callInterviewLLM(
          {
            system:
              "You are a rigorous interview coach writing a session report. Base every score strictly on the candidate's spoken transcript and question/answer history. Never invent things the transcript doesn't show. Confidence must be inferred ONLY from observable speech signals (filler words, answer length, hedging) — never from appearance or tone that isn't in the transcript.",
            conversation: [
              {
                role: "user",
                text: `Role practiced: ${role.label}\nSession duration: ${minutes}m ${seconds}s\n\nQUESTION & ANSWER HISTORY:\n${historyBlock}\n\nRAW TRANSCRIPT (voice-to-text):\n${transcriptText || "(empty)"}\n\nOBSERVABLE METRICS:\n- Total words: ${stats.totalWords}\n- Filler words (um/uh/like/you know): ${stats.fillerCount}\n- Hedges (maybe/probably/guess): ${stats.hedgeCount}\n- Avg words per answer: ${stats.avgAnswerWords}\n- Answers containing numbers/metrics: ${stats.hasMetrics ? "yes" : "no"}\n- Answers using STAR structure: ${stats.hasStar ? "yes" : "no"}\n\nReply with STRICT JSON only (no markdown fences), exactly this shape:\n{"score": 0-100, "communication": 0-100, "relevance": 0-100, "clarity": 0-100, "confidence": 0-100, "technical": 0-100, "summary": "2-3 sentences", "strengths": ["up to 4 concise bullets"], "improvements": ["up to 4 concise bullets"], "recommendations": ["up to 4 specific actionable steps"], "weakAnswerExample": "Q: <question>\\nOriginal: <weak answer>\\nImproved: <rewritten answer>"}`,
              },
            ],
            json: true,
            temperature: 0.4,
          },
          REPORT_TIMEOUT_MS,
        );
        const data = res.data ?? {};
        setReport(parseReport(data));
        setReportStatus("ready");
      } catch {
        // The heuristic report always works — the user never leaves empty-handed.
        setReport(fallbackReport(stats, role.label, qaHistory));
        setReportStatus("ready");
      }
    })();
  }

  // -------------------------------------------------------------------------
  // Transcript helpers
  // -------------------------------------------------------------------------

  const appendTurn = useCallback((speaker: string | null, text: string) => {
    const clean = text.trim();
    if (!clean) return;
    transcriptLogRef.current = [...transcriptLogRef.current, clean];
    turnId += 1;
    const turn: TranscriptTurn = { id: `t${turnId}`, speaker, text: clean, at: Date.now() };
    setTurns((prev) =>
      prev.length >= MAX_TURNS ? [...prev.slice(prev.length - MAX_TURNS + 1), turn] : [...prev, turn],
    );
  }, []);

  // -------------------------------------------------------------------------
  // Transport lifecycle
  // -------------------------------------------------------------------------

  const teardown = useCallback(async (waitForFlush: boolean) => {
    cancelSpeech();
    ttsActiveRef.current = false;
    if (iv.current.silenceTimer) {
      clearTimeout(iv.current.silenceTimer);
      iv.current.silenceTimer = null;
    }
    if (iv.current.deliveryTimer) {
      clearTimeout(iv.current.deliveryTimer);
      iv.current.deliveryTimer = null;
    }

    const capture = captureRef.current;
    captureRef.current = null;
    if (capture) {
      try {
        await capture.stop();
      } catch {
        // Mic teardown already released — nothing to recover.
      }
    }

    // If no capture was ever created (e.g. connection failed before the audio
    // graph started), release the raw stream by hand so the mic light goes off.
    const stream = streamRef.current;
    streamRef.current = null;
    if (stream && !capture) {
      for (const track of stream.getTracks()) track.stop();
    }

    const transcriber = transcriberRef.current;
    transcriberRef.current = null;
    if (transcriber) {
      try {
        // waitForFlush=true lets the server deliver the final in-flight turn.
        await transcriber.close(waitForFlush);
      } catch {
        // Socket may already be closed — expected on rapid stop.
      }
    }
  }, []);

  /** Shared path for unexpected drops: surface the error, settle the state, release resources. */
  const handleUnexpectedFailure = useCallback(
    (title: string, message: string) => {
      if (!runningRef.current) return; // user-initiated stop already handled it
      runningRef.current = false;
      setSpeaking(false);
      setLevel(0);
      setError({ title, message });
      // Keep the transcript visible when a live session drops; go back to the
      // start screen if the failure happened before we ever went live.
      setBoth(statusRef.current === "live" ? "stopped" : "idle");
      void teardown(false);
    },
    [setBoth, teardown],
  );

  const start = useCallback(
    async (roleId: RoleId = "software") => {
      if (runningRef.current) return;
      await teardown(false);

      setTurns([]);
      setError(null);
      setSpeaking(false);
      setLevel(0);
      setSessionId(null);
      setReportStatus("idle");
      setReport(null);
      transcriptLogRef.current = [];
      beganRef.current = false;
      runningRef.current = true;
      iv.current = freshRuntime(roleId);
      syncInterview();
      setBoth("connecting");

      let transcriber: StreamingTranscriber | null = null;
      try {
        // 1) Microphone first — permission problems surface instantly with clear
        //    copy instead of after a slow network handshake.
        const stream = await acquireMicStream();
        streamRef.current = stream;

        // 2) Short-lived token, minted server-side so the API key never leaves
        //    the Edge Function.
        const { token } = await fetchStreamingToken();

        // 3) Live transcription (AssemblyAI Universal Streaming, v3). The token
        //    travels as a query parameter — browsers can't set WebSocket headers
        //    — and the raw API key never touches this code.
        transcriber = new StreamingTranscriber({
          token,
          sampleRate: SAMPLE_RATE,
          speakerLabels: true,
          connectTimeout: CONNECT_TIMEOUT_MS,
          maxConnectionRetries: MAX_CONNECTION_RETRIES,
          connectionRetryDelay: CONNECTION_RETRY_DELAY_MS,
        });
        transcriberRef.current = transcriber;

        transcriber.on("open", (message) => {
          beganRef.current = true;
          setSessionId((message as OpenMessage).id ?? null);
          void beginInterview();
        });
        onSpeechStarted(transcriber, () => {
          setSpeaking(true);
          iv.current.lastActivityAt = Date.now();
        });
        transcriber.on("turn", (message) => {
          const turn = message as TurnMessage;
          setSpeaking(false);
          appendTurn(turn.speaker_label ?? null, turn.transcript ?? "");
          if (turn.transcript) handleFinalTurn(turn.transcript);
        });
        transcriber.on("error", (err) => {
          const detail = describeError(err as ErrorLike);
          handleUnexpectedFailure(detail.title, detail.message);
        });
        transcriber.on("close", (code, reason) => {
          if (!runningRef.current) {
            setSpeaking(false);
            return;
          }
          const known = STREAMING_CODE_MESSAGES[code];
          const message =
            known ??
            reason?.trim() ??
            "The live transcription connection dropped unexpectedly. Please try again.";
          handleUnexpectedFailure("Connection lost", message);
        });

        await transcriber.connect();

        // The user may have cancelled while the handshake was in flight.
        if (!runningRef.current) {
          try {
            await transcriber.close(false);
          } catch {
            // noop
          }
          transcriberRef.current = null;
          return;
        }

        const capture = await startMicCapture({
          stream,
          onPcm: (pcm) => {
            transcriber?.sendAudio(pcm);
          },
          onLevel: (rms) => {
            // Smooth the meter and map RMS into a 0..1 range for typical speech.
            setLevel((prev) => prev * 0.6 + Math.min(1, rms * 6) * 0.4);
          },
        });
        captureRef.current = capture;

        setBoth("live");
      } catch (err) {
        // A cancel mid-connect already reset everything — never overwrite it.
        if (!runningRef.current) return;
        runningRef.current = false;
        setSpeaking(false);
        setLevel(0);
        await teardown(false);
        setError(describeError(err));
        setBoth("idle");
      }
    },
    [appendTurn, handleUnexpectedFailure, setBoth, teardown],
  );

  const stop = useCallback(async () => {
    const current = statusRef.current;
    if (current !== "live" && current !== "connecting") return;
    runningRef.current = false;
    const wasLive = current === "live";
    setSpeaking(false);
    setLevel(0);
    setBoth(wasLive ? "stopped" : "idle");
    // Only wait for the final transcript flush if the session actually began.
    await teardown(wasLive && beganRef.current);
  }, [setBoth, teardown]);

  const endSession = useCallback(async () => {
    const current = statusRef.current;
    if (current !== "live" && current !== "stopped") return;
    runningRef.current = false;
    setSpeaking(false);
    setLevel(0);
    await teardown(current === "live");
    setBoth("ended");
    void generateReport();
  }, [setBoth, teardown]);

  const dismissError = useCallback(() => setError(null), []);

  /** Lets the candidate move on without waiting for the silence timeout. */
  const signalAnswerDone = useCallback(() => {
    if (!runningRef.current) return;
    if (iv.current.phase === "listening") finalizeAnswer();
  }, []);

  /** Retries the last failed AI action (first question / follow-up). */
  const retryInterviewAction = useCallback(() => {
    if (!runningRef.current) return;
    const pending = iv.current.pendingAi;
    if (!pending) return;
    iv.current.aiError = null;
    if (pending === "first") {
      beginInterview();
    } else {
      const last = iv.current.history[iv.current.history.length - 1];
      iv.current.phase = "thinking";
      syncInterview();
      followUpQuestion(
        iv.current.currentQuestion,
        last ? last.answer : iv.current.currentAnswer,
      );
    }
  }, []);

  const retryReport = useCallback(() => {
    if (statusRef.current !== "ended") return;
    generateReport();
  }, []);

  /** Session duration ticker. */
  useEffect(() => {
    if (status !== "live" && status !== "stopped") return;
    const interval = setInterval(() => {
      if (iv.current.startedAt && iv.current.phase !== "idle") {
        iv.current.durationSec = Math.floor((Date.now() - iv.current.startedAt) / 1000);
        syncInterview();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [status]);

  useEffect(() => {
    return () => {
      runningRef.current = false;
      void teardown(false);
    };
  }, [teardown]);

  return {
    status,
    turns,
    speaking,
    level,
    sessionId,
    error,
    interview,
    reportStatus,
    report,
    start,
    stop,
    endSession,
    dismissError,
    signalAnswerDone,
    retryInterviewAction,
    retryReport,
  };
}
