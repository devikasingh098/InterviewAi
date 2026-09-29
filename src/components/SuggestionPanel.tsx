import { CircleCheck, Lightbulb, Sparkles } from "lucide-react";
import { BASELINE_TIPS, type CoachingTip } from "../lib/coaching";
import type { InterviewPhase } from "../hooks/usePracticeSession";

type Props = {
  coaching: CoachingTip[];
  phase: InterviewPhase;
};

export function SuggestionPanel({ coaching, phase }: Props) {
  const inAnswer = phase === "listening" || phase === "thinking";
  const tips = inAnswer && coaching.length > 0 ? coaching : BASELINE_TIPS;
  const fromAi = coaching.some((tip) => tip.id.startsWith("ai-"));

  return (
    <aside aria-labelledby="suggestions-title" className="card flex flex-col gap-4 p-5">
      <header className="flex items-center gap-3">
        <span className="flex size-9 items-center justify-center rounded-lg bg-primary-soft text-primary">
          <Sparkles className="size-4.5" aria-hidden="true" />
        </span>
        <div>
          <h2 id="suggestions-title" className="text-sm font-semibold text-foreground">
            Live coaching
          </h2>
          <p className="text-[11px] text-muted">Talking points while you speak</p>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-2.5">
        {tips.map((tip) => (
          <div
            key={tip.id}
            className="flex items-start gap-2.5 rounded-xl border border-border bg-surface-2/50 p-3 animate-fade-up"
          >
            {tip.tone === "encourage" ? (
              <CircleCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            ) : (
              <Lightbulb className="mt-0.5 size-4 shrink-0 text-accent-deep" aria-hidden="true" />
            )}
            <p className="text-[0.85rem] leading-relaxed text-foreground">{tip.text}</p>
          </div>
        ))}
      </div>

      <p className="flex items-center justify-between gap-2 border-t border-border pt-3 text-[11px] text-muted">
        <span>
          {inAnswer && coaching.length > 0
            ? fromAi
              ? "AI coach, based on your answer"
              : "Signal-based, updated as you speak"
            : "Baseline reminders"}
        </span>
      </p>
    </aside>
  );
}
