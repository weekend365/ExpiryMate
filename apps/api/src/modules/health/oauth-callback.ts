const OAUTH_STATE_PREFIX = "em1.";
const DEFAULT_RETURN_URI = "expirymate://oauth";

const ALLOWED_RETURN_URI =
  /^(expirymate:\/\/|exp(?:\+[\w-]+)?:\/\/|https:\/\/auth\.expo\.io\/)/i;

export type OAuthCallbackQuery = {
  code?: string;
  state?: string;
  error?: string;
  error_description?: string;
  id_token?: string;
};

export function resolveOAuthReturnUri(rawState?: string | null): string {
  if (!rawState?.trim()) {
    return DEFAULT_RETURN_URI;
  }

  let value = rawState.trim();

  try {
    value = decodeURIComponent(value);
  } catch {
    // keep raw
  }

  if (value.startsWith(OAUTH_STATE_PREFIX)) {
    const decoded = decodeBase64Url(value.slice(OAUTH_STATE_PREFIX.length));
    if (decoded && isAllowedReturnUri(decoded)) {
      return decoded;
    }
  }

  if (isAllowedReturnUri(value)) {
    return value;
  }

  return DEFAULT_RETURN_URI;
}

export function buildOAuthDeepLink(
  returnUri: string,
  params: OAuthCallbackQuery,
): string {
  const target = isAllowedReturnUri(returnUri) ? returnUri : DEFAULT_RETURN_URI;

  return appendQuery(target, {
    code: params.code,
    id_token: params.id_token,
    error: params.error,
    error_description: params.error_description,
  });
}

export function canRedirectServerSide(query: OAuthCallbackQuery): boolean {
  return Boolean(query.code || query.error || query.id_token);
}

export function buildOAuthCallbackHtml(): string {
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
    <a id="openApp" href="#">앱으로 이어갈게요</a>
  </div>
  <script>
    (function () {
      var PREFIX = "em1.";
      var DEFAULT_URI = "expirymate://oauth";
      var ALLOWED = /^(expirymate:\\/\\/|exp(?:\\+[\\w-]+)?:\\/\\/|https:\\/\\/auth\\.expo\\.io\\/)/i;

      function decodeBase64Url(value) {
        try {
          var padded = value.replace(/-/g, "+").replace(/_/g, "/");
          while (padded.length % 4) padded += "=";
          return decodeURIComponent(
            Array.prototype.map
              .call(atob(padded), function (c) {
                return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
              })
              .join(""),
          );
        } catch (e) {
          return null;
        }
      }

      function resolveReturnUri(raw) {
        if (!raw) return DEFAULT_URI;
        var value = raw;
        try { value = decodeURIComponent(raw); } catch (e) {}
        if (value.indexOf(PREFIX) === 0) {
          var decoded = decodeBase64Url(value.slice(PREFIX.length));
          if (decoded && ALLOWED.test(decoded)) return decoded;
        }
        if (ALLOWED.test(value)) return value;
        return DEFAULT_URI;
      }

      function appendQuery(returnUri, params) {
        var pairs = [];
        Object.keys(params).forEach(function (key) {
          if (params[key]) {
            pairs.push(encodeURIComponent(key) + "=" + encodeURIComponent(params[key]));
          }
        });
        if (!pairs.length) return returnUri;
        return returnUri + (returnUri.indexOf("?") >= 0 ? "&" : "?") + pairs.join("&");
      }

      var search = window.location.search || "";
      var hash = window.location.hash || "";
      var query = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
      var fragment = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
      var returnUri = resolveReturnUri(fragment.get("state") || query.get("state"));
      var deepLink = appendQuery(returnUri, {
        code: query.get("code") || fragment.get("code"),
        id_token: fragment.get("id_token") || query.get("id_token"),
        error: query.get("error") || fragment.get("error"),
        error_description:
          query.get("error_description") || fragment.get("error_description"),
      });

      var link = document.getElementById("openApp");
      link.setAttribute("href", deepLink);

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

function isAllowedReturnUri(value: string) {
  return ALLOWED_RETURN_URI.test(value);
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
    return Buffer.from(base64, "base64").toString("utf8");
  } catch {
    return null;
  }
}
