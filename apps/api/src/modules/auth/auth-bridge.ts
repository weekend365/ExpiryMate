import { buildAppDeepLink } from "./app-links";

export type AuthBridgeKind = "verify-email" | "reset-password";

const COPY: Record<
  AuthBridgeKind,
  { title: string; status: string; cta: string }
> = {
  "verify-email": {
    title: "메일 확인으로 이어갈게요",
    status: "앱에서 가입을 마저 마무리하는 중이에요…",
    cta: "앱으로 이어갈게요",
  },
  "reset-password": {
    title: "비밀번호 다시 정하러 갈게요",
    status: "앱으로 돌아가는 중이에요…",
    cta: "앱으로 이어갈게요",
  },
};

export function buildAuthBridgeDeepLink(
  kind: AuthBridgeKind,
  token: string,
): string {
  return buildAppDeepLink(`auth/${kind}`, { token });
}

export function buildAuthBridgeHtml(
  kind: AuthBridgeKind,
  token: string,
): string {
  const deepLink = buildAuthBridgeDeepLink(kind, token);
  const copy = COPY[kind];
  const safeHref = escapeHtmlAttr(deepLink);

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(copy.title)}</title>
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
    h1 { font-size: 24px; margin: 0 0 16px; }
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
    <h1>${escapeHtml(copy.title)}</h1>
    <p id="status">${escapeHtml(copy.status)}</p>
    <a id="openApp" href="${safeHref}">${escapeHtml(copy.cta)}</a>
  </div>
  <script>
    (function () {
      var deepLink = ${JSON.stringify(deepLink)};
      var link = document.getElementById("openApp");
      link.setAttribute("href", deepLink);
      window.location.replace(deepLink);
      setTimeout(function () {
        document.getElementById("status").textContent =
          "앱이 열리지 않으면 아래 버튼을 눌러 주세요.";
      }, 1500);
    })();
  </script>
</body>
</html>`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeHtmlAttr(value: string) {
  return escapeHtml(value).replace(/'/g, "&#39;");
}
