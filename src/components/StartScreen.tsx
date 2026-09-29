import { useRef, type KeyboardEvent } from "react";
import { Briefcase, FileText, MessageSquareText, Mic, ShieldCheck, Sparkles } from "lucide-react";
import { ROLES, type RoleId } from "../hooks/usePracticeSession";

const FEATURES = [
  {
    icon: MessageSquareText,
    title: "Live transcript",
    body: "Speaker-labelled, real-time. You talk, it types — so you can focus on the conversation.",
  },
  {
    icon: Sparkles,
    title: "Talking points",
    body: "As your answers unfold, suggested points for the current question appear on the side.",
  },
  {
    icon: FileText,
    title: "Session report",
    body: "When you finish, review how the practice went and what to refine before the real thing.",
  },
];

type Props = {
  roleId: RoleId;
  onSelectRole: (role: RoleId) => void;
  onStart: () => void;
};

export function StartScreen({ roleId, onSelectRole, onStart }: Props) {
  const radioRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const selectAndFocus = (index: number) => {
    const nextRole = ROLES[index];
    if (!nextRole) return;
    onSelectRole(nextRole.id);
    radioRefs.current[index]?.focus();
  };

  const handleRadioKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = ROLES.length - 1;
    let nextIndex: number | null = null;

    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        nextIndex = index === last ? 0 : index + 1;
        break;
      case "ArrowLeft":
      case "ArrowUp":
        nextIndex = index === 0 ? last : index - 1;
        break;
      case "Home":
        nextIndex = 0;
        break;
      case "End":
        nextIndex = last;
        break;
      default:
        return;
    }

    event.preventDefault();
    selectAndFocus(nextIndex);
  };

  return (
    <div className="mx-auto mt-4 flex max-w-2xl flex-col items-center text-center animate-fade-up sm:mt-8">
      <div className="relative mb-8" aria-hidden="true">
        <span className="absolute -inset-4 animate-breathe rounded-full bg-primary/15 blur-2xl" />
        <span className="relative flex size-16 items-center justify-center rounded-2xl border border-primary/20 bg-surface shadow-lg">
          <Mic className="size-7 text-primary" />
        </span>
      </div>

      <h1 className="max-w-xl text-balance text-4xl font-bold leading-[1.1] text-foreground sm:text-5xl">
        Practice the interview until it feels easy.
      </h1>
      <p className="mt-4 max-w-lg text-balance text-base leading-relaxed text-muted sm:text-lg">
        An AI interviewer asks the questions, transcribes your answers live, coaches you as you
        speak, and hands you a report when you&apos;re done.
      </p>

      <div className="mt-7 flex w-full max-w-md flex-col items-center gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Briefcase className="size-4 text-primary" aria-hidden="true" />
          Which role are you practicing for?
        </p>
        <div role="radiogroup" aria-label="Interview type" className="grid w-full grid-cols-2 gap-2">
          {ROLES.map((role, index) => (
            <button
              key={role.id}
              ref={(el) => {
                radioRefs.current[index] = el;
              }}
              type="button"
              role="radio"
              aria-checked={roleId === role.id}
              tabIndex={roleId === role.id ? 0 : -1}
              className={`card cursor-pointer px-4 py-3 text-sm font-semibold transition-colors duration-150 ${
                roleId === role.id
                  ? "border-primary/50 bg-primary-soft text-foreground"
                  : "text-muted hover:border-border hover:bg-surface-2"
              }`}
              onClick={() => onSelectRole(role.id)}
              onKeyDown={(event) => handleRadioKeyDown(event, index)}
            >
              {role.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-7 flex flex-col items-center gap-3">
        <button type="button" className="btn-primary px-8 py-4 text-base" onClick={onStart}>
          <Mic className="size-5" aria-hidden="true" />
          Start practice
        </button>
        <p className="flex items-center gap-1.5 text-xs text-muted">
          <ShieldCheck className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
          Audio is streamed live for transcription and isn&apos;t stored.
        </p>
      </div>

      <dl className="mt-12 grid w-full gap-3 text-left sm:grid-cols-3">
        {FEATURES.map((feature) => (
          <div key={feature.title} className="card p-4">
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary-soft text-primary">
              <feature.icon className="size-4.5" aria-hidden="true" />
            </span>
            <dt className="mt-3 text-sm font-semibold text-foreground">{feature.title}</dt>
            <dd className="mt-1 text-xs leading-relaxed text-muted">{feature.body}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
