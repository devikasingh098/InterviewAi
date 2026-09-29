import { requireEnv } from "./env";

/**
 * Calls a Supabase Edge Function from the browser. The AssemblyAI/Gemini API
 * keys never touch this code — they live in the functions' secrets and stay
 * server-side.
 */
export async function callEdgeFunction<T>(functionName: string, body?: unknown): Promise<T> {
  const { url, anonKey } = requireEnv();

  const res = await fetch(`${url}/functions/v1/${functionName}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${anonKey}`,
      apikey: anonKey,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    // Non-JSON error body — fall through to the status-based message.
  }

  if (!res.ok) {
    const asRecord = (value: unknown): Record<string, unknown> =>
      typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
    const record = asRecord(data);
    const message =
      typeof record.error === "string"
        ? record.error
        : typeof record.message === "string"
          ? record.message
          : `Request to "${functionName}" failed (status ${res.status}).`;
    throw new Error(message);
  }

  return data as T;
}

/** Fetches a short-lived AssemblyAI streaming token from the Edge Function. */
export async function fetchStreamingToken(): Promise<{ token: string }> {
  const data = await callEdgeFunction<{ token?: string; error?: string }>("aai-token", {});
  if (!data || typeof data.token !== "string" || data.token.length === 0) {
    throw new Error(
      data?.error ??
        "Couldn't get a streaming token. Check that the AssemblyAI key is configured in the project's Edge Function secrets.",
    );
  }
  return { token: data.token };
}

export type LlmRole = "user" | "assistant";
export type LlmMessage = { role: LlmRole; text: string };

export type InterviewLlmRequest = {
  system?: string;
  /** Legacy single-shot mode. */
  prompt?: string;
  input_text?: string;
  /** Multi-turn mode for the interviewer. */
  conversation?: LlmMessage[];
  /** Ask the function to force JSON output and parse it into `data`. */
  json?: boolean;
  temperature?: number;
};

export type InterviewLlmResponse = {
  output: string;
  data?: Record<string, unknown> | null;
};

const LLM_TIMEOUT_MS = 30_000;

/**
 * Calls the aai-lemur Edge Function (Gemini via server-side secret) with a
 * client-side timeout and a single retry for transient network failures.
 * Permanent failures (auth, missing secret) surface as-is.
 */
export async function callInterviewLLM(
  request: InterviewLlmRequest,
  timeoutMs: number = LLM_TIMEOUT_MS,
): Promise<InterviewLlmResponse> {
  const { url, anonKey } = requireEnv();

  const attempt = async (): Promise<InterviewLlmResponse> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${url}/functions/v1/aai-lemur`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${anonKey}`,
          apikey: anonKey,
        },
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      let data: unknown = null;
      try {
        data = await res.json();
      } catch {
        // Non-JSON body — fall through to status handling.
      }

      if (!res.ok) {
        const record =
          typeof data === "object" && data !== null ? (data as Record<string, unknown>) : {};
        const message =
          typeof record.error === "string"
            ? record.error
            : `The AI service failed (status ${res.status}).`;
        throw new Error(message);
      }

      const record =
        typeof data === "object" && data !== null ? (data as Record<string, unknown>) : {};
      if (typeof record.output !== "string" || record.output.length === 0) {
        throw new Error("The AI service returned an empty response. Please retry.");
      }
      const parsed =
        typeof record.data === "object" && record.data !== null
          ? (record.data as Record<string, unknown>)
          : null;
      return { output: record.output, data: parsed };
    } finally {
      clearTimeout(timer);
    }
  };

  try {
    return await attempt();
  } catch (err) {
    const message = String((err as Error)?.message ?? err);
    // Don't retry permanent failures: bad auth, missing secret, hard 4xx.
    if (/not configured|status 4/.test(message)) throw err;
    await new Promise((resolve) => setTimeout(resolve, 900));
    return attempt();
  }
}
