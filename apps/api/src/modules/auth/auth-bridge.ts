import { buildHtmlBridgeStyles } from "../../common/html-bridge-styles";
import { buildAppDeepLink } from "./app-links";

export type AuthBridgeKind = "verify-email" | "reset-password";

const BRIDGE_STYLES = buildHtmlBridgeStyles({ includeHint: true });

/** Mobile mail clients: open the app with the raw token (app consumes it). */
export function buildMobileVerifyEmailBridgeHtml(token: string): string {
  const deepLink = buildAppDeepLink("auth/verify-email", { token });
  const safeHref = escapeHtmlAttr(deepLink);

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>메일 확인으로 이어갈게요</title>
  <style>${BRIDGE_STYLES}</style>
</head>
<body>
  <div>
    <h1>메일 확인으로 이어갈게요</h1>
    <p id="status">앱에서 가입을 마저 마무리하는 중이에요…</p>
    <a id="openApp" href="${safeHref}">앱으로 이어갈게요</a>
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

/** Desktop: verification already done server-side — tell the user to log in on the app. */
export function buildDesktopVerifyEmailResultHtml(input: {
  ok: boolean;
  message?: string;
}): string {
  if (input.ok) {
    return renderStaticPage({
      title: "메일 확인이 끝났어요",
      status:
        "이제 앱으로 돌아와 들어와 주세요. 가입이 끝난 상태예요.",
    });
  }

  return renderStaticPage({
    title: "앗, 확인하지 못했어요",
    status:
      input.message ??
      "인증 링크가 만료됐거나 이미 쓰였어요. 앱에서 메일을 다시 받아 주세요.",
  });
}

export function buildInvalidAuthLinkHtml(): string {
  return renderStaticPage({
    title: "유효하지 않은 링크예요",
    status: "메일의 링크를 다시 확인해 주세요.",
  });
}

export function buildAuthBridgeDeepLink(
  kind: AuthBridgeKind,
  token: string,
): string {
  return buildAppDeepLink(`auth/${kind}`, { token });
}

export function buildResetPasswordBridgeHtml(token: string): string {
  const deepLink = buildAuthBridgeDeepLink("reset-password", token);
  const safeHref = escapeHtmlAttr(deepLink);

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>비밀번호 다시 정하러 갈게요</title>
  <style>${BRIDGE_STYLES}</style>
</head>
<body>
  <div>
    <h1>비밀번호 다시 정하러 갈게요</h1>
    <p id="status">앱으로 돌아가는 중이에요…</p>
    <a id="openApp" href="${safeHref}">앱으로 이어갈게요</a>
    <p class="hint">
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

export function isMobileUserAgent(userAgent: string | undefined): boolean {
  if (!userAgent) {
    return false;
  }

  return /Mobile|Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini|Expo/i.test(
    userAgent,
  );
}

function renderStaticPage(input: { title: string; status: string }): string {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(input.title)}</title>
  <style>${BRIDGE_STYLES}</style>
</head>
<body>
  <div>
    <h1>${escapeHtml(input.title)}</h1>
    <p>${escapeHtml(input.status)}</p>
  </div>
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
