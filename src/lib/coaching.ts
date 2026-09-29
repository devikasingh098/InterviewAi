/**
 * Instant, rule-based coaching signals computed from the current answer
 * transcript. These fire on every finalized turn with zero latency so the
 * coaching panel always has something useful while the LLM-based tips are
 * being generated in the background.
 */

export type CoachingTip = {
  id: string;
  text: string;
  tone: "attention" | "encourage";
};

const FILLER_RE =
  /\b(um+|uh+|er+|hmm+|like|you know|basically|sort of|kind of|kinda|i mean)\b/gi;
const HEDGE_RE = /\b(maybe|probably|i guess|i suppose|not sure|i think i can|hopefully|perhaps)\b/gi;
const METRIC_RE =
  /(\d+(?:[.,]\d+)?%?|\b\d+\b\s*(users|people|customers|requests|orders|dollars|percent|%|ms|seconds|days|weeks|months|team members|engineers|projects|countries)\b)/i;
const STAR_RE =
  /(situation|task|action|result|outcome|impact|challenge|deadline|decided|had to|was asked|responsible|goal|led|improved|increased|reduced|shipped|launched|delivered|solved|resolved|built|designed|created)/i;
const FIRST_PERSON_RE = /\b(i|my|we|our|me)\b/i;

type Rule = { id: string; text: string; tone: "attention" | "encourage"; hit: (t: string) => boolean };

const RULES: Rule[] = [
  {
    id: "short",
    text: "Give a specific example — a story with a beginning, middle and end.",
    tone: "attention",
    hit: (t) => countWords(t) < 25,
  },
  {
    id: "fillers",
    text: "Limit filler words like “um” and “like” — pauses read as confidence.",
    tone: "attention",
    hit: (t) => (t.match(FILLER_RE) ?? []).length >= 2,
  },
  {
    id: "hedges",
    text: "Drop hedges like “probably” — commit to your answer.",
    tone: "attention",
    hit: (t) => (t.match(HEDGE_RE) ?? []).length >= 1,
  },
  {
    id: "star",
    text: "Structure it: Situation → Task → Action → Result.",
    tone: "attention",
    hit: (t) => !STAR_RE.test(t),
  },
  {
    id: "metrics",
    text: "Mention the result or impact — add a number or measurable outcome.",
    tone: "attention",
    hit: (t) => !METRIC_RE.test(t),
  },
  {
    id: "role",
    text: "Explain your role clearly — say what you personally did.",
    tone: "attention",
    hit: (t) => !FIRST_PERSON_RE.test(t),
  },
  {
    id: "long",
    text: "Keep the answer concise — wrap it up around the 90-second mark.",
    tone: "attention",
    hit: (t) => countWords(t) > 170,
  },
  {
    id: "strong",
    text: "Strong answer — concrete outcome with clear structure.",
    tone: "encourage",
    hit: (t) => METRIC_RE.test(t) && STAR_RE.test(t) && (t.match(FILLER_RE) ?? []).length < 2,
  },
];

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Returns the top coaching tips (max 3) for the current answer text.
 * The first match wins so priority is by declaration order above.
 */
export function analyzeAnswerForCoaching(text: string): CoachingTip[] {
  const clean = text.trim();
  if (!clean) return [];
  const tips: CoachingTip[] = [];
  for (const rule of RULES) {
    if (tips.length >= 3) break;
    if (rule.hit(clean)) {
      tips.push({ id: rule.id, text: rule.text, tone: rule.tone });
    }
  }
  return tips;
}

/** Baseline tips shown before the candidate starts answering. */
export const BASELINE_TIPS: CoachingTip[] = [
  { id: "baseline-star", text: "Use STAR: Situation → Task → Action → Result.", tone: "encourage" },
  { id: "baseline-example", text: "Give one concrete example with a number.", tone: "encourage" },
  { id: "baseline-length", text: "Aim for 60–90 seconds per answer.", tone: "encourage" },
];
