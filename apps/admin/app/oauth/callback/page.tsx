"use client";

import { appBrand } from "@expirymate/shared";
import { useEffect, useMemo, useState } from "react";

/**
 * Fallback mirror of API `/oauth/callback`.
 * Prefer the API URL in EXPO_PUBLIC_OAUTH_REDIRECT_URI.
 */
export default function OAuthCallbackPage() {
  const [status, setStatus] = useState("로그인 정보를 정리하고 있어요…");
  const deepLink = useMemo(() => buildDeepLinkFromLocation(), []);

  useEffect(() => {
    if (!deepLink) {
      setStatus("앱으로 돌아가지 못했어요. 앱에서 다시 이어가 주세요.");
      return;
    }

    setStatus("앱으로 돌아가는 중이에요…");
    try {
      window.location.replace(deepLink);
    } catch {
      setStatus("아래 버튼을 눌러 앱으로 이어가 주세요.");
    }
  }, [deepLink]);

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="inline-flex rounded-full bg-[var(--primary-soft)] px-3 py-1 text-sm font-bold text-[var(--primary)]">
        {appBrand.appNameKo}
      </div>
      <h1 className="text-2xl font-black tracking-tight text-[var(--foreground)]">
        거의 다 됐어요
      </h1>
      <p className="text-sm leading-6 text-[var(--muted)]">{status}</p>
      {deepLink ? (
        <a
          href={deepLink}
          className="inline-flex min-h-[52px] items-center justify-center rounded-2xl bg-[var(--primary)] px-6 text-sm font-bold text-white"
        >
          앱으로 이어갈게요
        </a>
      ) : null}
    </main>
  );
}

function buildDeepLinkFromLocation() {
  if (typeof window === "undefined") {
    return null;
  }

  const search = window.location.search ?? "";
  const hash = window.location.hash ?? "";
  const query = new URLSearchParams(
    search.startsWith("?") ? search.slice(1) : search,
  );
  const fragment = new URLSearchParams(
    hash.startsWith("#") ? hash.slice(1) : hash,
  );
  const returnUri = resolveReturnUri(
    fragment.get("state") || query.get("state"),
  );

  return appendQuery(returnUri, {
    code: query.get("code") || fragment.get("code") || undefined,
    id_token: fragment.get("id_token") || query.get("id_token") || undefined,
    error: query.get("error") || fragment.get("error") || undefined,
    error_description:
      query.get("error_description") ||
      fragment.get("error_description") ||
      undefined,
  });
}

function resolveReturnUri(raw: string | null) {
  const DEFAULT_URI = "expirymate://oauth";
  const PREFIX = "em1.";
  const ALLOWED =
    /^(expirymate:\/\/|exp(?:\+[\w-]+)?:\/\/|https:\/\/auth\.expo\.io\/)/i;

  if (!raw) {
    return DEFAULT_URI;
  }

  let value = raw;
  try {
    value = decodeURIComponent(raw);
  } catch {
    // keep raw
  }

  if (value.startsWith(PREFIX)) {
    const decoded = decodeBase64Url(value.slice(PREFIX.length));
    if (decoded && ALLOWED.test(decoded)) {
      return decoded;
    }
  }

  if (ALLOWED.test(value)) {
    return value;
  }

  return DEFAULT_URI;
}

function appendQuery(
  returnUri: string,
  params: Record<string, string | undefined>,
) {
  const pairs: string[] = [];

  for (const [key, value] of Object.entries(params)) {
    if (value) {
      pairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
    }
  }

  if (pairs.length === 0) {
    return returnUri;
  }

  return `${returnUri}${returnUri.includes("?") ? "&" : "?"}${pairs.join("&")}`;
}

function decodeBase64Url(value: string) {
  try {
    const padded = value.replace(/-/g, "+").replace(/_/g, "/");
    const padLength = (4 - (padded.length % 4)) % 4;
    const base64 = padded + "=".repeat(padLength);
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}
