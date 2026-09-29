import { CircleCheck, LoaderCircle, RotateCcw, TriangleAlert } from "lucide-react";
import type { ReportStatus } from "../hooks/usePracticeSession";
import type { SessionReport } from "../lib/report";

type Props = {
  report: SessionReport | null;
  reportStatus: ReportStatus;
  roleLabel: string;
  qaCount: number;
  turnCount: number;
  onRetry: () => void;
  onStartNew: () => void;
};

type ReportScoreKey = "communication" | "relevance" | "clarity" | "confidence" | "technical";

const CATEGORIES: { key: ReportScoreKey; label: string; note: string }[] = [
  { key: "communication", label: "Communication", note: "Filler words, flow, sentence completion" },
  { key: "relevance", label: "Relevance", note: "Answers matched the question" },
  { key: "clarity", label: "Clarity", note: "Structure and specificity" },
  { key: "confidence", label: "Confidence", note: "Transcript signals only — fillers, hedging, length" },
  { key: "technical", label: "Technical / content", note: "Depth and correctness of substance" },
];

function scoreColor(n: number): string {
  if (n >= 75) return "text-primary";
  if (n >= 55) return "text-accent-deep";
  return "text-destructive";
}

function ScoreRing({ score }: { score: number }) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(1, Math.max(0, score / 100)));
  return (
    <div className="relative flex size-32 items-center justify-center" aria-hidden="true">
      <svg viewBox="0 0 120 120" className="size-32 -rotate-90">
        <circle cx="60" cy="60" r={radius} fill="none" stroke="var(--surface-2)" strokeWidth="10" />
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={`transition-all duration-700 ease-out ${scoreColor(score)}`}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className={`font-heading text-4xl font-bold tabular-nums ${scoreColor(score)}`}>
          {score}
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">/ 100</span>
      </div>
    </div>
  );
}

export function SessionReportPanel({ report, reportStatus, roleLabel, qaCount, turnCount, onRetry, onStartNew }: Props) {
  if (reportStatus === "generating") {
    return (
      <div className="card mx-auto mt-4 flex max-w-md flex-col items-center gap-3 p-8 text-center animate-fade-up">
        <LoaderCircle className="size-7 animate-spin text-primary" aria-hidden="true" />
        <p className="text-sm font-semibold text-foreground">Generating your session report…</p>
        <p className="text-xs leading-relaxed text-muted">
          The coach is scoring your answers, strengths and next steps. This takes a few seconds.
        </p>
      </div>
    );
  }

  if (reportStatus === "error" || !report) {
    return (
      <div className="card mx-auto mt-4 flex max-w-md flex-col items-center gap-3 p-8 text-center animate-fade-up">
        <TriangleAlert className="size-7 text-accent-deep" aria-hidden="true" />
        <p className="text-sm font-semibold text-foreground">No speech was captured this session.</p>
        <p className="text-xs leading-relaxed text-muted">
          The transcript is empty, so there&apos;s nothing to score yet. Run another practice and
          speak clearly into the microphone.
        </p>
        <button type="button" className="btn-primary" onClick={onStartNew}>
          <RotateCcw className="size-4" aria-hidden="true" />
          Start new practice
        </button>
      </div>
    );
  }

  const categories = CATEGORIES.map((c) => ({ ...c, value: Math.max(0, Math.min(100, Number(report[c.key]) || 0)) }));

  return (
    <section aria-labelledby="report-title" className="card flex flex-col gap-6 p-6 sm:p-8 animate-fade-up">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="report-title" className="flex items-center gap-2 font-heading text-xl font-bold text-foreground">
            <CircleCheck className="size-5 text-primary" aria-hidden="true" />
            Session report
          </h2>
          <p className="mt-1 text-sm text-muted">
            {roleLabel} practice · {qaCount} question{qaCount === 1 ? "" : "s"} answered ·{" "}
            {turnCount} transcript turn{turnCount === 1 ? "" : "s"}
          </p>
        </div>
        <span className="pill text-[11px]">Session ended</span>
      </header>

      {report.partial && (
        <p className="rounded-xl border border-accent/30 bg-accent-soft/30 px-4 py-2.5 text-xs leading-relaxed text-foreground">
          The AI coach was busy, so these scores were estimated from the transcript signals. Tap
          retry below if you&apos;d like the full AI breakdown.
        </p>
      )}

      <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start sm:gap-8">
        <ScoreRing score={report.score} />
        <p className="max-w-md text-sm leading-relaxed text-foreground">{report.summary}</p>
      </div>

      <div className="flex flex-col gap-3.5">
        {categories.map((c) => (
          <div key={c.key} className="flex items-center gap-3">
            <div className="w-40 shrink-0">
              <p className="text-sm font-semibold text-foreground">{c.label}</p>
              <p className="text-[11px] leading-tight text-muted">{c.note}</p>
            </div>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2" role="presentation">
              <div className="meter-fill" style={{ width: `${c.value}%` }} />
            </div>
            <span className={`w-10 shrink-0 text-right text-sm font-bold tabular-nums ${scoreColor(c.value)}`}>
              {c.value}
            </span>
          </div>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface-2/50 p-4">
          <p className="text-sm font-semibold text-foreground">Strengths</p>
          <ul className="mt-2.5 flex flex-col gap-2">
            {report.strengths.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm leading-relaxed text-foreground">
                <CircleCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                {s}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-border bg-surface-2/50 p-4">
          <p className="text-sm font-semibold text-foreground">Areas to improve</p>
          <ul className="mt-2.5 flex flex-col gap-2">
            {report.improvements.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm leading-relaxed text-foreground">
                <TriangleAlert className="mt-0.5 size-4 shrink-0 text-accent-deep" aria-hidden="true" />
                {s}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface-2/50 p-4">
        <p className="text-sm font-semibold text-foreground">Specific recommendations</p>
        <ol className="mt-2.5 flex flex-col gap-2">
          {report.recommendations.map((r, i) => (
            <li key={i} className="flex items-start gap-2 text-sm leading-relaxed text-foreground">
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary-soft text-[11px] font-bold text-primary">
                {i + 1}
              </span>
              {r}
            </li>
          ))}
        </ol>
      </div>

      {report.weakAnswerExample && (
        <div className="rounded-xl border border-primary/25 bg-primary-soft/20 p-4">
          <p className="text-sm font-semibold text-foreground">
            How a weak answer could be improved
          </p>
          <pre className="mt-2.5 whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground">
            {report.weakAnswerExample}
          </pre>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        {report.partial && (
          <button type="button" className="btn-secondary" onClick={onRetry}>
            <LoaderCircle className="size-4" aria-hidden="true" />
            Regenerate full report
          </button>
        )}
        <button type="button" className="btn-primary" onClick={onStartNew}>
          <RotateCcw className="size-4" aria-hidden="true" />
          Start new practice
        </button>
      </div>
    </section>
  );
}
