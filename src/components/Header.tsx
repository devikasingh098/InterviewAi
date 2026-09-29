import { AudioLines } from "lucide-react";
import type { SessionStatus } from "../hooks/usePracticeSession";

const STATUS_META: Record<SessionStatus, { label: string; dot: string }> = {
  idle: { label: "Ready", dot: "bg-fg-muted" },
  connecting: { label: "Connecting…", dot: "bg-accent animate-pulse" },
  live: { label: "Live", dot: "bg-primary animate-pulse" },
  stopped: { label: "Stopped", dot: "bg-fg-muted" },
  ended: { label: "Session ended", dot: "bg-success" },
};

export function Header({ status }: { status: SessionStatus }) {
  const meta = STATUS_META[status];
  return (
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-5 sm:px-6 lg:px-8">
      <div className="flex items-center gap-3">
        <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-on-primary shadow-md">
          <AudioLines className="size-5" aria-hidden="true" />
        </span>
        <div>
          <p className="font-heading text-[15px] font-bold leading-tight tracking-tight">Interview Copilot</p>
          <p className="text-[11px] leading-tight text-muted">Live practice copilot</p>
        </div>
      </div>
      <p className="pill" aria-live="polite">
        <span className={`size-2 rounded-full ${meta.dot}`} aria-hidden="true" />
        {meta.label}
      </p>
    </header>
  );
}