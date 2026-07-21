const DEFAULT_RETURN_URI = "expirymate://oauth";

export type OAuthCallbackQuery = {
  code?: string;
  state?: string;
  error?: string;
  error_description?: string;
  id_token?: string;
};

/**
 * Exact allowlist of app return URIs (comma-separated env).
 * No wildcard matching — auth.expo.io paths must be listed explicitly if needed.
 */
export function getOAuthAppReturnAllowlist(
  envValue = process.env.OAUTH_APP_RETURN_URIS,
): string[] {
  const fromEnv =
    envValue
      ?.split(",")
      .map((value) => value.trim())
      .filter(Boolean) ?? [];

  if (fromEnv.length > 0) {
    return fromEnv;
  }

  return [DEFAULT_RETURN_URI];
}

export function isAllowedOAuthReturnUri(
  value: string,
  allowlist = getOAuthAppReturnAllowlist(),
): boolean {
  return allowlist.includes(value.trim());
}

export function getOAuthProviderRedirectUri(
  envValue = process.env.OAUTH_PROVIDER_REDIRECT_URI,
): string | null {
  const value = envValue?.trim();
  return value || null;
}

export function buildOAuthDeepLink(
  returnUri: string,
  params: OAuthCallbackQuery,
  allowlist = getOAuthAppReturnAllowlist(),
): string {
  const target = isAllowedOAuthReturnUri(returnUri, allowlist)
    ? returnUri.trim()
    : DEFAULT_RETURN_URI;

  return appendQuery(target, {
    code: params.code,
    state: params.state,
    id_token: params.id_token,
    error: params.error,
    error_description: params.error_description,
  });
}

export function canRedirectServerSide(query: OAuthCallbackQuery): boolean {
  return Boolean(query.code || query.error || query.id_token);
}

export function buildInvalidOAuthCallbackHtml(): string {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>로그인 연결</title>
  <style>
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #f1f3f5;
      color: #1a1f27;
      text-align: center;
      padding: 24px;
    }
    p { color: #4e5561; line-height: 1.5; margin: 0; }
  </style>
</head>
<body>
  <div>
    <h1>로그인 연결이 만료됐어요</h1>
    <p>앱으로 돌아가 소셜 로그인을 다시 시작해 주세요.</p>
  </div>
</body>
</html>`;
}

/** HTML bridge with a server-resolved deep link (never decode return URI from client state). */
export function buildOAuthCallbackHtml(deepLink: string): string {
  const safeHref = escapeHtmlAttribute(deepLink);

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>로그인 연결 중</title>
  <style>
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #f1f3f5;
      color: #1a1f27;
      text-align: center;
      padding: 24px;
    }
    p { color: #4e5561; line-height: 1.5; margin: 0 0 24px; }
    a {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 52px;
      padding: 0 24px;
      border-radius: 16px;
      background: #10b981;
      color: #fff;
      font-weight: 700;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div>
    <h1>거의 다 됐어요</h1>
    <p id="status">앱으로 돌아가는 중이에요…</p>
    <a id="openApp" href="${safeHref}">앱으로 이어갈게요</a>
  </div>
  <script>
    (function () {
      var deepLink = ${JSON.stringify(deepLink)};
      function go() {
        try {
          window.location.replace(deepLink);
        } catch (e) {
          document.getElementById("status").textContent =
            "아래 버튼을 눌러 앱으로 이어가 주세요.";
        }
      }
      go();
      setTimeout(go, 400);
    })();
  </script>
</body>
</html>`;
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

function escapeHtmlAttribute(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
