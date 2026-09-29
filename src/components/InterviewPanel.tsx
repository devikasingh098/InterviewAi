import {
  Bot,
  BrainCircuit,
  Check,
  Clock,
  Flag,
  LoaderCircle,
  Mic,
  TriangleAlert,
  Volume2,
} from "lucide-react";
import type { InterviewPhase, InterviewState } from "../hooks/usePracticeSession";

type Props = {
  interview: InterviewState;
  /** Whether STT detected the user speaking right now. */
  speaking: boolean;
  onAnswerDone: () => void;
  onRetryAI: () => void;
};

const PHASE_META: Record<
  InterviewPhase,
  { label: string; Icon: typeof Mic; className: string }
> = {
  idle: { label: "Ready", Icon: Mic, className: "bg-surface-2 text-muted" },
  starting: { label: "Starting…", Icon: LoaderCircle, className: "bg-primary-soft text-primary" },
  ai_speaking: { label: "Interviewer speaking", Icon: Volume2, className: "bg-accent-soft text-accent-deep" },
  listening: { label: "Listening — answer away", Icon: Mic, className: "bg-primary-soft text-primary" },
  thinking: { label: "Thinking…", Icon: BrainCircuit, className: "bg-primary-soft text-primary" },
  wrapped: { label: "That's a wrap", Icon: Flag, className: "bg-success/15 text-success" },
  error: { label: "Needs your input", Icon: TriangleAlert, className: "bg-destructive/15 text-destructive" },
};

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function InterviewPanel({ interview, speaking, onAnswerDone, onRetryAI }: Props) {
  const { phase, questionNumber, totalQuestions, currentQuestion, currentAnswer, aiError, roleLabel, durationSec, log } =
    interview;
  const meta = PHASE_META[phase];
  const recentLog = log.slice(-8);
  const progress = questionNumber > 0 ? questionNumber : 0;

  return (
    <section aria-labelledby="interview-title" className="card flex flex-col gap-4 p-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="interview-title" className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Bot className="size-4 text-primary" aria-hidden="true" />
          AI Interviewer
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <span className="pill bg-surface-2 text-[11px]">{roleLabel}</span>
          <span className="pill text-[11px]">
            <Clock className="size-3.5 text-muted" aria-hidden="true" />
            {formatDuration(durationSec)}
          </span>
          <span className="pill text-[11px]" aria-live="polite">
            Question {Math.min(progress, totalQuestions)} of {totalQuestions}
          </span>
        </div>
      </header>

      <div className="flex items-center gap-2.5">
        <span className={`flex size-8 items-center justify-center rounded-lg ${meta.className}`}>
          <meta.Icon className={`size-4 ${phase === "thinking" || phase === "starting" ? "animate-spin" : ""}`} aria-hidden="true" />
        </span>
        <p className="text-sm font-semibold text-foreground" aria-live="polite">
          {meta.label}
          {phase === "listening" && speaking ? " — you're speaking, keep going" : ""}
        </p>
      </div>

      <div
        role="status"
        aria-live="polite"
        className="flex flex-col gap-3 rounded-2xl border border-primary/20 bg-primary-soft/30 p-5"
      >
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
            {progress > 0 ? `Question ${progress} of ${totalQuestions}` : "Next up"}
          </p>
          <div className="flex items-center gap-1.5" aria-hidden="true">
            {Array.from({ length: totalQuestions }).map((_, i) => (
              <span
                key={i}
                className={`size-1.5 rounded-full transition-colors duration-150 ${
                  i < progress ? "bg-primary" : i === progress ? "bg-accent" : "bg-surface-2"
                }`}
              />
            ))}
          </div>
        </div>

        {currentQuestion ? (
          <p className="font-heading text-lg font-semibold leading-snug text-foreground">
            {currentQuestion}
          </p>
        ) : (
          <p className="text-sm text-muted">
            {phase === "starting"
              ? "Preparing your first question…"
              : "The interviewer will greet you once the connection is up."}
          </p>
        )}
      </div>

      {phase === "listening" && (
        <div className="flex flex-col gap-2.5">
          <div className="flex items-start justify-between gap-3 rounded-xl border border-border bg-surface-2/50 p-4">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                Your answer (live)
              </p>
              {currentAnswer ? (
                <p className="mt-1.5 text-sm leading-relaxed text-foreground">{currentAnswer}</p>
              ) : (
                <p className="mt-1.5 text-sm text-muted">Listening — start whenever you're ready…</p>
              )}
            </div>
          </div>
          {currentAnswer && (
            <button type="button" className="btn-secondary self-end" onClick={onAnswerDone}>
              <Check className="size-4" aria-hidden="true" />
              I&apos;m done — next question
            </button>
          )}
        </div>
      )}

      {phase === "error" && aiError && (
        <div role="alert" className="flex items-start justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4">
          <div className="flex items-start gap-2.5">
            <TriangleAlert className="mt-0.5 size-4.5 shrink-0 text-destructive" aria-hidden="true" />
            <p className="text-sm leading-relaxed text-foreground">{aiError}</p>
          </div>
          <button type="button" className="btn-secondary shrink-0" onClick={onRetryAI}>
            <LoaderCircle className="size-4" aria-hidden="true" />
            Retry
          </button>
        </div>
      )}

      {recentLog.length > 0 && (
        <div className="flex flex-col gap-2.5 border-t border-border pt-4">
          {recentLog.map((turn, i) => {
            const isInterviewer = turn.role === "interviewer";
            return (
              <div
                key={`${turn.at}-${i}`}
                className={`flex gap-2.5 ${isInterviewer ? "" : "flex-row-reverse"}`}
              >
                <span
                  className={`flex size-6 shrink-0 items-center justify-center rounded-lg ${
                    isInterviewer ? "bg-primary-soft text-primary" : "bg-accent-soft text-accent-deep"
                  }`}
                  aria-hidden="true"
                >
                  {isInterviewer ? <Bot className="size-3.5" /> : <Mic className="size-3.5" />}
                </span>
                <div
                  className={`max-w-[85%] rounded-xl border px-3 py-2 text-[0.85rem] leading-relaxed ${
                    isInterviewer
                      ? "border-border bg-surface-2/50 text-foreground"
                      : "border-accent/20 bg-accent-soft/30 text-foreground"
                  }`}
                >
                  {turn.text}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
