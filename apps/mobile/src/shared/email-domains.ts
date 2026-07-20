/** Korea-first email domains for select-based domain picker. */
export const EMAIL_DOMAINS = [
  "naver.com",
  "gmail.com",
  "daum.net",
  "hanmail.net",
  "kakao.com",
  "nate.com",
  "icloud.com",
  "outlook.com",
] as const;

/** @deprecated Use EMAIL_DOMAINS */
export const EMAIL_DOMAIN_SUGGESTIONS = EMAIL_DOMAINS;

export const EMAIL_DOMAIN_MANUAL = "manual" as const;

export type EmailDomainMode = typeof EMAIL_DOMAIN_MANUAL | (typeof EMAIL_DOMAINS)[number];

export function splitEmail(value: string): { local: string; domain: string } {
  const at = value.lastIndexOf("@");
  if (at < 0) {
    return { local: value, domain: "" };
  }

  return {
    local: value.slice(0, at),
    domain: value.slice(at + 1),
  };
}

export function joinEmail(local: string, domain: string): string {
  const trimmedLocal = local.trim();
  const trimmedDomain = domain.trim();

  if (!trimmedLocal && !trimmedDomain) {
    return "";
  }

  if (!trimmedDomain) {
    return trimmedLocal;
  }

  return `${trimmedLocal}@${trimmedDomain}`;
}

export function resolveDomainMode(domain: string): EmailDomainMode {
  const normalized = domain.trim().toLowerCase();
  if (
    EMAIL_DOMAINS.includes(normalized as (typeof EMAIL_DOMAINS)[number])
  ) {
    return normalized as (typeof EMAIL_DOMAINS)[number];
  }

  return EMAIL_DOMAIN_MANUAL;
}
