"use client";

import { appBrand } from "@expirymate/shared";
import { useEffect, useState } from "react";

/**
 * Fallback mirror of API `/oauth/callback`.
 * Prefer the API URL in EXPO_PUBLIC_OAUTH_REDIRECT_URI until Admin is redeployed.
 */
export default function OAuthCallbackPage() {
  const [status, setStatus] = useState("로그인 정보를 정리하고 있어요…");

  useEffect(() => {
    const search = window.location.search ?? "";
    const hash = window.location.hash ?? "";
    const query = new URLSearchParams(
      search.startsWith("?") ? search.slice(1) : search,
    );
    const fragment = new URLSearchParams(
      hash.startsWith("#") ? hash.slice(1) : hash,
    );
    const rawReturn =
      fragment.get("state") || query.get("state") || "expirymate://oauth";

    let returnUri = rawReturn;
    try {
      returnUri = decodeURIComponent(rawReturn);
    } catch {
      // keep raw
    }

    if (
      !/^expirymate:\/\//.test(returnUri) &&
      !/^exp:\/\//.test(returnUri)
    ) {
      returnUri = "expirymate://oauth";
    }

    try {
      window.location.replace(`${returnUri}${search}${hash}`);
      setStatus("앱으로 돌아가는 중이에요…");
    } catch {
      setStatus("앱으로 돌아가지 못했어요. 앱에서 다시 이어가 주세요.");
    }
  }, []);

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="inline-flex rounded-full bg-[var(--primary-soft)] px-3 py-1 text-sm font-bold text-[var(--primary)]">
        {appBrand.appNameKo}
      </div>
      <h1 className="text-2xl font-black tracking-tight text-[var(--foreground)]">
        거의 다 됐어요
      </h1>
      <p className="text-sm leading-6 text-[var(--muted)]">{status}</p>
    </main>
  );
}
