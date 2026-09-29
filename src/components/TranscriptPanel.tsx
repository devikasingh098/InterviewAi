import { useEffect, useRef } from "react";
import { AudioLines, Bot, MessageSquareText } from "lucide-react";
import type { SessionStatus, TranscriptTurn } from "../hooks/usePracticeSession";

const AI_SPEAKER = "__interviewer__";

const DOT_COLORS = ["bg-primary", "bg-accent", "bg-fg-muted"];
const LABEL_COLORS = ["text-primary", "text-accent-deep", "text-muted"];

type Props = {
  turns: TranscriptTurn[];
  speaking: boolean;
  level: number;
  status: SessionStatus;
};

function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function TranscriptPanel({ turns, speaking, level, status }: Props) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const pinnedRef = useRef(true);
  const speakerOrder = useRef(new Map<string, number>());

  // Assign stable labels by order of first appearance. The candidate's mic is
  // the first (and usually only) human speaker — they become "You".
  useEffect(() => {
    for (const turn of turns) {
      if (turn.speaker && turn.speaker !== AI_SPEAKER && !speakerOrder.current.has(turn.speaker)) {
        speakerOrder.current.set(turn.speaker, speakerOrder.current.size);
      }
    }
  }, [turns]);

  // Auto-scroll to the newest turn, but only while the user is pinned to the bottom.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !pinnedRef.current) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ top: el.scrollHeight, behavior: reduceMotion ? "auto" : "smooth" });
  }, [turns, speaking]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    pinnedRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 96;
  };

  const live = status === "live";
  const hasTurns = turns.length > 0;

  return (
    <section aria-labelledby="transcript-title" className="card flex min-h-0 flex-col overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h2 id="transcript-title" className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <MessageSquareText className="size-4 text-primary" aria-hidden="true" />
          Live transcript
          <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-muted">
            {turns.length} turn{turns.length === 1 ? "" : "s"}
          </span>
        </h2>
        <p className="flex items-center gap-3 text-[11px] font-medium text-muted">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-primary" aria-hidden="true" /> You
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-accent" aria-hidden="true" /> Interviewer
          </span>
        </p>
      </header>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        aria-label="Session transcript"
        className="min-h-[18rem] flex-1 space-y-3 overflow-y-auto px-4 py-4 lg:max-h-[calc(100dvh-17rem)]"
      >
        {turns.map((turn) => {
          if (turn.speaker === AI_SPEAKER) {
            return (
              <div
                key={turn.id}
                className="flex gap-3 rounded-xl border border-primary/20 bg-primary-soft/25 p-3"
              >
                <span className="mt-1 flex size-5 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary">
                  <Bot className="size-3" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-primary">
                      Interviewer
                    </span>
                    <time className="shrink-0 text-[11px] tabular-nums text-muted">
                      {formatTime(turn.at)}
                    </time>
                  </div>
                  <p className="mt-1 text-[0.95rem] leading-relaxed text-foreground">{turn.text}</p>
                </div>
              </div>
            );
          }

          const order = turn.speaker ? (speakerOrder.current.get(turn.speaker) ?? 0) : -1;
          const dotColor = order === -1 ? "bg-fg-muted" : DOT_COLORS[order % DOT_COLORS.length];
          const labelColor = order === -1 ? "text-muted" : LABEL_COLORS[order % LABEL_COLORS.length];
          const label = order === -1 ? "Unknown speaker" : order === 0 ? "You" : `Speaker ${order + 1}`;
          return (
            <div key={turn.id} className="flex gap-3 rounded-xl border border-border bg-surface-2/50 p-3">
              <span className={`mt-1.5 size-2.5 shrink-0 rounded-full ${dotColor}`} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className={`text-[11px] font-semibold uppercase tracking-wide ${labelColor}`}>{label}</span>
                  <time className="shrink-0 text-[11px] tabular-nums text-muted">{formatTime(turn.at)}</time>
                </div>
                <p className="mt-1 text-[0.95rem] leading-relaxed text-foreground">{turn.text}</p>
              </div>
            </div>
          );
        })}

        {speaking && (
          <div className="flex items-center gap-2.5 px-1 text-sm text-muted">
            <span className="relative flex size-2.5" aria-hidden="true">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60" />
              <span className="relative inline-flex size-2.5 rounded-full bg-primary" />
            </span>
            Listening — speaker detected…
          </div>
        )}

        {!hasTurns && !speaking && (live ? (
          <div className="flex flex-col items-center gap-2 py-14 text-center">
            <AudioLines className="size-8 animate-breathe text-primary" aria-hidden="true" />
            <p className="text-sm font-medium text-foreground">Ready when you are.</p>
            <p className="max-w-xs text-xs leading-relaxed text-muted">
              The interviewer&apos;s questions and your spoken answers appear here automatically.
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-14 text-center">
            <p className="text-sm font-medium text-foreground">No speech captured.</p>
            <p className="max-w-xs text-xs leading-relaxed text-muted">
              Start a new practice session to record a transcript.
            </p>
          </div>
        ))}
      </div>

      <footer className="flex items-center gap-3 border-t border-border px-4 py-3">
        <span className="w-16 shrink-0 text-[11px] font-semibold uppercase tracking-wide text-muted">Mic</span>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2" role="presentation">
          <div
            className="meter-fill"
            style={{ width: `${Math.round(Math.min(1, level) * 100)}%` }}
            aria-hidden="true"
          />
        </div>
        <span className="inline-flex items-center rounded-full border border-border bg-surface-2 px-2.5 py-1 text-[11px] font-semibold text-muted">
          {live ? "Live" : status === "stopped" ? "Stopped" : "Ended"}
        </span>
      </footer>
    </section>
  );
}
