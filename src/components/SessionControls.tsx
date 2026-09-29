import { CircleCheck, RotateCcw, Square } from "lucide-react";
import type { SessionStatus } from "../hooks/usePracticeSession";

type Props = {
  status: SessionStatus;
  turnCount: number;
  /** Interview is complete (all questions asked) — nudges the user to end the session. */
  wrapped?: boolean;
  onStop: () => void;
  onEnd: () => void;
  onStartNew: () => void;
};

export function SessionControls({ status, turnCount, wrapped, onStop, onEnd, onStartNew }: Props) {
  if (status === "live") {
    return (
      <div role="status" className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn-secondary" onClick={onStop}>
          <Square className="size-4" aria-hidden="true" />
          Stop
        </button>
        <button type="button" className="btn-primary" onClick={onEnd}>
          <CircleCheck className="size-4" aria-hidden="true" />
          {wrapped ? "End session & get report" : "End session"}
        </button>
      </div>
    );
  }

  if (status === "stopped") {
    return (
      <div role="status" className="card flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <p className="text-sm font-semibold text-foreground">Listening stopped.</p>
          <p className="mt-0.5 text-sm text-muted">
            Your transcript is kept — end the session for the report or start a fresh practice.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button type="button" className="btn-secondary" onClick={onStartNew}>
            <RotateCcw className="size-4" aria-hidden="true" />
            Start new practice
          </button>
          <button type="button" className="btn-primary" onClick={onEnd}>
            <CircleCheck className="size-4" aria-hidden="true" />
            End session & get report
          </button>
        </div>
      </div>
    );
  }

  return (
    <div role="status" className="card flex flex-wrap items-center justify-between gap-4 p-5">
      <div className="flex items-center gap-3">
        <CircleCheck className="size-6 shrink-0 text-success" aria-hidden="true" />
        <div>
          <p className="text-sm font-semibold text-foreground">Session complete.</p>
          <p className="mt-0.5 text-sm text-muted">
            {turnCount === 0
              ? "No speech was captured this time."
              : `${turnCount} turn${turnCount === 1 ? "" : "s"} captured — your report is above.`}
          </p>
        </div>
      </div>
      <button type="button" className="btn-primary" onClick={onStartNew}>
        <RotateCcw className="size-4" aria-hidden="true" />
        Start new practice
      </button>
    </div>
  );
}
