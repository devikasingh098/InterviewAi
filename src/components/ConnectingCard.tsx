import { LoaderCircle, X } from "lucide-react";

type Props = {
  /** Lets the user abort a slow handshake. Omitted when there's nothing to cancel. */
  onCancel?: () => void;
};

export function ConnectingCard({ onCancel }: Props) {
  return (
    <div className="card mx-auto mt-16 flex max-w-md flex-col items-center gap-3 p-8 text-center animate-fade-up">
      <LoaderCircle className="size-7 animate-spin text-primary" aria-hidden="true" />
      <p className="text-sm font-semibold text-foreground">Connecting to live transcription…</p>
      <p className="text-xs leading-relaxed text-muted">
        Fetching a secure session token and opening your microphone. This takes a few seconds.
      </p>
      {onCancel && (
        <button type="button" className="btn-secondary mt-1" onClick={onCancel}>
          <X className="size-4" aria-hidden="true" />
          Cancel
        </button>
      )}
    </div>
  );
}
