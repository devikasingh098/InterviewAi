import { useEffect, useState } from "react";
import { usePracticeSession, type RoleId } from "./hooks/usePracticeSession";
import { useResolvedTheme } from "./hooks/useTheme";
import { Header } from "./components/Header";
import { StartScreen } from "./components/StartScreen";
import { ConnectingCard } from "./components/ConnectingCard";
import { InterviewPanel } from "./components/InterviewPanel";
import { TranscriptPanel } from "./components/TranscriptPanel";
import { SuggestionPanel } from "./components/SuggestionPanel";
import { SessionReportPanel } from "./components/SessionReportPanel";
import { SessionControls } from "./components/SessionControls";
import { ErrorBanner } from "./components/ErrorBanner";

export default function App() {
  const {
    status,
    turns,
    speaking,
    level,
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
  } = usePracticeSession();
  const theme = useResolvedTheme();
  const [roleId, setRoleId] = useState<RoleId>("software");

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  const inSession = status !== "idle";
  const wrapped = interview.phase === "wrapped";

  return (
    <div className="app-background flex min-h-dvh flex-col">
      <Header status={status} />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-12 pt-4 sm:px-6 lg:px-8">
        {error && <ErrorBanner title={error.title} message={error.message} onDismiss={dismissError} />}

        {!inSession ? (
          <StartScreen roleId={roleId} onSelectRole={setRoleId} onStart={() => start(roleId)} />
        ) : status === "connecting" ? (
          <ConnectingCard onCancel={stop} />
        ) : status === "ended" ? (
          <div className="flex flex-col gap-4">
            <SessionReportPanel
              report={report}
              reportStatus={reportStatus}
              roleLabel={interview.roleLabel}
              qaCount={interview.history.length}
              turnCount={turns.length}
              onRetry={retryReport}
              onStartNew={() => start(roleId)}
            />
            <TranscriptPanel turns={turns} speaking={speaking} level={level} status={status} />
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_21rem]">
            <div className="flex min-w-0 flex-col gap-4">
              <InterviewPanel
                interview={interview}
                speaking={speaking}
                onAnswerDone={signalAnswerDone}
                onRetryAI={retryInterviewAction}
              />
              <TranscriptPanel turns={turns} speaking={speaking} level={level} status={status} />
              <SessionControls
                status={status}
                turnCount={turns.length}
                wrapped={wrapped}
                onStop={stop}
                onEnd={endSession}
                onStartNew={() => start(roleId)}
              />
            </div>
            <SuggestionPanel coaching={interview.coaching} phase={interview.phase} />
          </div>
        )}
      </main>

      <footer className="pb-6 text-center text-xs text-muted">
        Your audio is processed live for transcription and isn&apos;t stored. AI interviewer powered by
        AssemblyAI streaming speech-to-text + Gemini via secure edge functions.
      </footer>
    </div>
  );
}
