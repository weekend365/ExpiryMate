import { buildAppDeepLink } from "./app-links";

export type AuthBridgeKind = "verify-email" | "reset-password";

const RESET_COPY = {
  title: "비밀번호 다시 정하러 갈게요",
  status: "앱으로 돌아가는 중이에요…",
  cta: "앱으로 이어갈게요",
};

/**
 * Email verify bridge: completes verification in the browser first
 * (desktop mail clients cannot open the app), then offers a deep link to login.
 * Reset-password still only deep-links into the app form.
 */
export function buildAuthBridgeDeepLink(
  kind: AuthBridgeKind,
  token: string,
): string {
  if (kind === "verify-email") {
    return buildAppDeepLink("auth/login");
  }

  return buildAppDeepLink(`auth/${kind}`, { token });
}

export function buildAuthBridgeHtml(
  kind: AuthBridgeKind,
  token: string,
): string {
  if (kind === "verify-email") {
    return buildVerifyEmailBridgeHtml(token);
  }

  return buildResetPasswordBridgeHtml(token);
}

function buildVerifyEmailBridgeHtml(token: string): string {
  const loginDeepLink = buildAppDeepLink("auth/login");
  const safeLoginHref = escapeHtmlAttr(loginDeepLink);

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>메일 확인</title>
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
    a, button {
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
      border: 0;
      font-size: 16px;
      cursor: pointer;
    }
    a[hidden], button[hidden] { display: none !important; }
    .hint { color: #8a939f; font-size: 14px; margin-top: 16px; }
  </style>
</head>
<body>
  <div>
    <h1 id="title">메일을 확인하고 있어요</h1>
    <p id="status">가입을 마저 마무리하는 중이에요…</p>
    <a id="openApp" href="${safeLoginHref}" hidden>앱에서 로그인할게요</a>
  </div>
  <script>
    (function () {
      var token = ${JSON.stringify(token)};
      var loginDeepLink = ${JSON.stringify(loginDeepLink)};
      var titleEl = document.getElementById("title");
      var statusEl = document.getElementById("status");
      var openApp = document.getElementById("openApp");

      openApp.setAttribute("href", loginDeepLink);

      fetch("/auth/email/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify({ token: token }),
      })
        .then(function (response) {
          return response.json().then(function (body) {
            return { ok: response.ok, body: body };
          });
        })
        .then(function (result) {
          if (result.body && result.body.success) {
            titleEl.textContent = "메일 확인이 끝났어요";
            statusEl.textContent =
              "이제 앱으로 돌아가 로그인해 주세요. 가입이 끝난 상태예요.";
            openApp.hidden = false;
            // Mobile Safari / in-app browsers: try opening the app.
            window.setTimeout(function () {
              window.location.href = loginDeepLink;
            }, 400);
            return;
          }

          var message =
            (result.body &&
              result.body.error &&
              result.body.error.message) ||
            "앗, 인증 링크가 만료됐거나 이미 쓰였어요. 앱에서 메일을 다시 받아 주세요.";
          titleEl.textContent = "앗, 확인하지 못했어요";
          statusEl.textContent = message;
        })
        .catch(function () {
          titleEl.textContent = "앗, 잠시 문제가 생겼어요";
          statusEl.textContent =
            "인터넷 연결을 확인하고 링크를 다시 열어 주세요.";
        });
    })();
  </script>
</body>
</html>`;
}

function buildResetPasswordBridgeHtml(token: string): string {
  const deepLink = buildAppDeepLink("auth/reset-password", { token });
  const copy = RESET_COPY;
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
    <p class="hint" style="color:#8a939f;font-size:14px;margin-top:16px;">
      컴퓨터에서는 앱이 열리지 않아요. 휴대폰에서 이 링크를 다시 열어 주세요.
    </p>
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
