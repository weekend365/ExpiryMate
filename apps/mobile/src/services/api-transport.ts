import { resolveApiBaseUrl } from "@expirymate/shared";
import type { ZodType } from "zod";
import { captureStartupBootstrapIssue } from "./bootstrap-diagnostics";

const API_BASE_URL = resolveApiBaseUrl({
  value: process.env.EXPO_PUBLIC_API_BASE_URL,
  production: (process.env.EXPO_PUBLIC_APP_ENV ?? "development") === "production",
  variableName: "EXPO_PUBLIC_API_BASE_URL",
});

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const buildUrl = (path: string) => `${API_BASE_URL}${path}`;
export const clientHeaders = {
  "X-App-Version": process.env.EXPO_PUBLIC_APP_VERSION ?? "1.4.0",
  "X-Client-Platform": "mobile",
};

export async function publicRequest<T>(
  path: string,
  init?: RequestInit,
  schema?: ZodType<T>,
): Promise<T> {
  const response = await fetchWithNetworkError(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...clientHeaders,
      ...(init?.headers ?? {}),
    },
  });
  const body = await parseEnvelope(response, schema);

  if (!response.ok || !body.success) {
    throw new ApiError(
      body.error?.message ??
        "앗, 잠시 문제가 생겼어요. 조금 뒤에 다시 해볼까요?",
      body.error?.code ?? `HTTP_${response.status}`,
      response.status,
      body.error?.details,
    );
  }

  return body.data;
}

const DEFAULT_FETCH_TIMEOUT_MS = 25_000;
export const RECIPE_GENERATION_TIMEOUT_MS = 90_000;
export const PHOTO_PARSE_TIMEOUT_MS = 90_000;

export async function fetchWithNetworkError(
  path: string,
  init?: RequestInit,
  timeoutMs = DEFAULT_FETCH_TIMEOUT_MS,
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const upstreamSignal = init?.signal;

  const onUpstreamAbort = () => controller.abort();
  upstreamSignal?.addEventListener("abort", onUpstreamAbort);

  try {
    return await fetch(buildUrl(path), {
      ...init,
      // Authenticated inventory responses must never be satisfied by a stale
      // native URL cache. In particular, an empty 304 response cannot be
      // decoded as our JSON envelope on a restored/review-device session.
      cache: "no-store",
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("응답이 너무 늦어요. 잠시 뒤 다시 해볼까요?");
    }
    throw new Error("인터넷 연결을 한번 봐 주세요.");
  } finally {
    clearTimeout(timer);
    upstreamSignal?.removeEventListener("abort", onUpstreamAbort);
  }
}

export async function parseEnvelope<T>(response: Response, schema?: ZodType<T>) {
  let value: unknown;
  try {
    value = await response.json();
  } catch {
    throw new Error("앗, 답을 제대로 받지 못했어요.");
  }

  if (!value || typeof value !== "object" || !("success" in value)) {
    throw new Error("서버 응답 형식을 확인하지 못했어요.");
  }

  const candidate = value as {
    success?: unknown;
    data?: unknown;
    error?: unknown;
  };
  if (typeof candidate.success !== "boolean") {
    throw new Error("서버 응답 형식을 확인하지 못했어요.");
  }

  let error: ApiEnvelope<unknown>["error"];
  if (candidate.error !== undefined) {
    if (!candidate.error || typeof candidate.error !== "object") {
      throw new Error("서버 오류 응답 형식을 확인하지 못했어요.");
    }
    const rawError = candidate.error as Record<string, unknown>;
    error = {
      code: typeof rawError.code === "string" ? rawError.code : undefined,
      message: typeof rawError.message === "string" ? rawError.message : undefined,
      details: rawError.details,
    };
  }

  if (!candidate.success) {
    return { success: false, data: candidate.data as T, error };
  }

  if (!schema) {
    return { success: true, data: candidate.data as T, error };
  }

  const parsed = schema.safeParse(candidate.data);
  if (!parsed.success) {
    captureStartupBootstrapIssue("api.response-schema", parsed.error, {
      status: response.status,
    });
    throw new Error("서버 응답 형식을 확인하지 못했어요.");
  }
  return { success: true, data: parsed.data, error };
}

