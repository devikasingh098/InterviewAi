import { TriangleAlert, X } from "lucide-react";

type Props = {
  title: string;
  message: string;
  onDismiss: () => void;
};

export function ErrorBanner({ title, message, onDismiss }: Props) {
  return (
    <div
      role="alert"
      className="mb-5 flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4"
    >
      <TriangleAlert className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="mt-0.5 text-sm leading-relaxed text-muted">{message}</p>
      </div>
      <button type="button" className="icon-btn p-1.5" aria-label="Dismiss error" onClick={onDismiss}>
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}