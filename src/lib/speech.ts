/**
 * Best-effort browser text-to-speech for the AI interviewer's questions.
 * Uses the built-in Web Speech API — no keys, no network. Silently no-ops when
 * speech synthesis is unavailable (some browsers/headless environments), so
 * the interview still works as on-screen text.
 */

export function speakText(text: string, onEnd?: () => void): void {
  try {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      onEnd?.();
      return;
    }
    const synth = window.speechSynthesis;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 1.05;
    utterance.pitch = 1;
    const voice =
      synth.getVoices().find((v) => v.lang.toLowerCase().startsWith("en")) ?? null;
    if (voice) utterance.voice = voice;
    utterance.onend = () => onEnd?.();
    utterance.onerror = () => onEnd?.();
    synth.speak(utterance);
  } catch {
    onEnd?.();
  }
}

export function cancelSpeech(): void {
  try {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  } catch {
    // noop
  }
}
