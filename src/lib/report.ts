/**
 * Session report types, transcript-only observable metrics, and a heuristic
 * fallback report used when the LLM report call fails (so the user always gets
 * something useful at the end of a session).
 */

export type SessionReport = {
  score: number;
  communication: number;
  relevance: number;
  clarity: number;
  confidence: number;
  technical: number;
  summary: string;
  strengths: string[];
  improvements: string[];
  recommendations: string[];
  weakAnswerExample: string;
  partial?: boolean;
};

export type QaPair = { question: string; answer: string };

export type ObservableStats = {
  totalWords: number;
  fillerCount: number;
  fillerDensity: number; // fillers per 100 words
  hedgeCount: number;
  answerCount: number;
  avgAnswerWords: number;
  longestAnswerWords: number;
  shortestAnswerWords: number;
  durationSec: number;
  hasMetrics: boolean;
  hasStar: boolean;
};

const FILLER_RE =
  /\b(um+|uh+|er+|hmm+|like|you know|basically|sort of|kind of|kinda|i mean)\b/gi;
const HEDGE_RE = /\b(maybe|probably|i guess|i suppose|not sure|i think i can|hopefully|perhaps)\b/gi;
const METRIC_RE =
  /(\d+(?:[.,]\d+)?%?|\b\d+\b\s*(users|people|customers|requests|orders|dollars|percent|%|ms|seconds|days|weeks|months|team members|engineers|projects|countries)\b)/i;
const STAR_RE =
  /(situation|task|action|result|outcome|impact|challenge|deadline|decided|had to|was asked|responsible|goal|led|improved|increased|reduced|shipped|launched|delivered|solved|resolved|built|designed|created)/i;

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function computeObservableStats(
  transcriptText: string,
  qaHistory: QaPair[],
  durationSec: number,
): ObservableStats {
  const totalWords = countWords(transcriptText);
  const fillerCount = (transcriptText.match(FILLER_RE) ?? []).length;
  const hedgeCount = (transcriptText.match(HEDGE_RE) ?? []).length;
  const fillerDensity = totalWords === 0 ? 0 : Math.round((fillerCount / totalWords) * 100);

  const answerWords = qaHistory.map((qa) => countWords(qa.answer)).filter((n) => n > 0);
  const answered = qaHistory.length;
  const avgAnswerWords =
    answerWords.length === 0
      ? 0
      : Math.round(answerWords.reduce((a, b) => a + b, 0) / answerWords.length);
  const longestAnswerWords = answerWords.length === 0 ? 0 : Math.max(...answerWords);
  const shortestAnswerWords = answerWords.length === 0 ? 0 : Math.min(...answerWords);

  return {
    totalWords,
    fillerCount,
    fillerDensity,
    hedgeCount,
    answerCount: answered,
    avgAnswerWords,
    longestAnswerWords,
    shortestAnswerWords,
    durationSec,
    hasMetrics: METRIC_RE.test(transcriptText),
    hasStar: STAR_RE.test(transcriptText),
  };
}

export function clampScore(n: number, min = 30, max = 95): number {
  return Math.max(min, Math.min(max, Math.round(n)));
}

/**
 * Deterministic heuristic report derived only from observable transcript
 * signals. Used when the LLM report call fails — marked `partial: true`.
 */
export function fallbackReport(
  stats: ObservableStats,
  roleLabel: string,
  qaHistory: QaPair[] = [],
): SessionReport {
  const { fillerDensity, hasMetrics, hasStar, answerCount, avgAnswerWords, hedgeCount } = stats;

  let score = 58;
  if (fillerDensity < 3) score += 10;
  else if (fillerDensity < 6) score += 4;
  if (hasMetrics) score += 8;
  if (hasStar) score += 8;
  if (answerCount >= 4) score += 6;
  else if (answerCount >= 2) score += 3;
  if (avgAnswerWords >= 50 && avgAnswerWords <= 150) score += 6;
  else if (avgAnswerWords > 0 && avgAnswerWords < 30) score -= 5;
  if (hedgeCount >= 3) score -= 4;
  score = clampScore(score);

  const communication = clampScore(score + (fillerDensity < 3 ? 5 : -5));
  const relevance = clampScore(score + (hasStar ? 6 : -4));
  const clarity = clampScore(score + (avgAnswerWords > 0 && avgAnswerWords <= 160 ? 5 : -6));
  const confidence = clampScore(score + (fillerDensity < 3 ? 7 : -7) + (hedgeCount >= 3 ? -3 : 3));
  const technical = clampScore(score + (hasMetrics ? 6 : -3));

  const strengths: string[] = [];
  if (answerCount > 0) strengths.push(`Answered ${answerCount} question${answerCount === 1 ? "" : "s"} without giving up.`);
  if (fillerDensity < 3) strengths.push("Kept filler words to a minimum — this reads as confident and prepared.");
  if (hasMetrics) strengths.push("Used numbers and concrete outcomes in at least one answer.");
  if (hasStar) strengths.push("Followed a clear narrative structure (Situation → Action → Result).");
  if (strengths.length === 0) strengths.push("You showed up and practiced — that's the first step to improving.");

  const improvements: string[] = [];
  if (fillerDensity >= 3)
    improvements.push(`Filler words appeared about ${fillerDensity} times per 100 words — tighten with short pauses instead of “um”/“like”.`);
  if (!hasMetrics) improvements.push("No measurable outcomes were mentioned — add numbers (users, %, time saved).");
  if (!hasStar) improvements.push("Answers lacked a clear structure — try Situation → Task → Action → Result.");
  if (avgAnswerWords > 0 && avgAnswerWords < 40)
    improvements.push(`Answers averaged only ${avgAnswerWords} words — expand with a concrete example.`);
  if (avgAnswerWords > 170)
    improvements.push("Answers ran long — aim for 60–90 seconds and land the point earlier.");
  if (hedgeCount >= 3) improvements.push("Hedging words (“probably”, “maybe”) undercut authority — commit to your statements.");
  if (improvements.length === 0) improvements.push("Push yourself with a follow-up round: ask for a harder question next time.");

  const recommendations = [
    "Practice the same role again and aim for a higher score on your weakest category.",
    `Rehearse answers out loud — silent practice misses filler words and pacing.`,
    `Prepare 2–3 STAR stories tailored to a ${roleLabel} role before the real interview.`,
    "Record one more session next week and compare your filler density and structure.",
  ];

  const weakAnswerExample =
    stats.answerCount === 0
      ? "No answer was captured this session, so there's no weak answer to rewrite — run another practice and speak clearly into the mic."
      : `Q: ${lastQuestion(qaHistory)}\nOriginal: “${lastAnswer(qaHistory)}”\nImproved: “Aim for a compact version: start with the outcome, add one number, then one short example that shows your specific role.”`;

  return {
    score,
    communication,
    relevance,
    clarity,
    confidence,
    technical,
    summary: `A ${roleLabel} practice session based purely on what you said — use the signals below to target your next round.`,
    strengths,
    improvements,
    recommendations,
    weakAnswerExample,
    partial: true,
  };
}

function lastQuestion(qaHistory: QaPair[]): string {
  return qaHistory.length > 0 ? qaHistory[qaHistory.length - 1].question : "";
}

function lastAnswer(qaHistory: QaPair[]): string {
  const a = qaHistory.length > 0 ? qaHistory[qaHistory.length - 1].answer : "";
  return a.length > 140 ? `${a.slice(0, 140)}…` : a;
}
