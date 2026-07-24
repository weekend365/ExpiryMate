import { Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import nodemailer from "nodemailer";
import { buildAuthHttpsLink } from "./app-links";

const MAIL_TIMEOUT_MS = 12_000;

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  async sendEmailVerification(email: string, token: string) {
    const verifyUrl = buildAuthHttpsLink("auth/verify-email", { token });

    await this.sendMail({
      to: email,
      subject: "메일 확인으로 가입을 마저 마무리해 주세요",
      text: [
        "안녕하세요, 장고예요.",
        "",
        "아래 링크를 누르면 가입이 끝나요.",
        verifyUrl,
        "",
        "링크는 잠시 뒤 만료돼요. 요청한 적이 없다면 이 메일은 무시해 주세요.",
      ].join("\n"),
      html: `
        <p>안녕하세요, 장고예요.</p>
        <p>아래 버튼을 누르면 가입이 끝나요.</p>
        <p><a href="${verifyUrl}">메일 확인하고 시작하기</a></p>
        <p>링크는 잠시 뒤 만료돼요. 요청한 적이 없다면 이 메일은 무시해 주세요.</p>
      `,
    });
  }

  async sendPasswordReset(email: string, token: string) {
    const resetUrl = buildAuthHttpsLink("auth/reset-password", { token });

    await this.sendMail({
      to: email,
      subject: "비밀번호를 다시 정해 주세요",
      text: [
        "안녕하세요, 장고예요.",
        "",
        "아래 링크로 비밀번호를 다시 정할 수 있어요.",
        resetUrl,
        "",
        "요청한 적이 없다면 이 메일은 무시해 주세요.",
      ].join("\n"),
    });
  }

  async sendSpaceInvitation(input: {
    email: string;
    token: string;
    spaceName: string;
    inviterName: string;
  }) {
    const inviteUrl = buildAuthHttpsLink("space-invitations/open", {
      token: input.token,
    });
    const spaceName = input.spaceName.replace(/[\r\n]+/g, " ").trim();
    const inviterName = input.inviterName.replace(/[\r\n]+/g, " ").trim();

    await this.sendMail({
      to: input.email,
      subject: `${spaceName} 냉장고를 함께 써볼까요?`,
      text: [
        "안녕하세요, 장고예요.",
        "",
        `${inviterName}님이 '${spaceName}' 냉장고로 초대했어요.`,
        "아래 링크를 누르면 함께 재고를 정리할 수 있어요.",
        inviteUrl,
        "",
        "초대 링크는 7일 뒤 만료돼요. 모르는 초대라면 무시해 주세요.",
      ].join("\n"),
      html: `
        <p>안녕하세요, 장고예요.</p>
        <p>${escapeHtml(inviterName)}님이 <strong>${escapeHtml(spaceName)}</strong> 냉장고로 초대했어요.</p>
        <p><a href="${escapeHtml(inviteUrl)}">함께 쓰러 갈게요</a></p>
        <p>초대 링크는 7일 뒤 만료돼요. 모르는 초대라면 무시해 주세요.</p>
      `,
    });
  }

  async sendSupportInquiryAlert(input: {
    to: string;
    inquiryId: string;
    categoryLabel: string;
    body: string;
    userId: string;
    userEmail?: string | null;
    createdAt: Date;
  }) {
    const when = input.createdAt.toISOString();
    const contact = input.userEmail?.trim() || "(이메일 없음)";

    await this.sendMail({
      to: input.to,
      subject: `[장고 문의] ${input.categoryLabel} · ${input.inquiryId}`,
      text: [
        "앱에서 새 문의가 도착했어요.",
        "",
        `문의 ID: ${input.inquiryId}`,
        `주제: ${input.categoryLabel}`,
        `사용자: ${input.userId}`,
        `이메일: ${contact}`,
        `시각: ${when}`,
        "",
        "—— 내용 ——",
        input.body,
        "",
        "답장은 사용자 이메일로 직접 보내 주세요.",
      ].join("\n"),
    });
  }

  private async sendMail(input: {
    to: string;
    subject: string;
    text: string;
    html?: string;
  }) {
    const host = process.env.SMTP_HOST?.trim();
    const user = process.env.SMTP_USER?.trim();
    const pass = process.env.SMTP_PASS?.trim();
    const resendApiKey = process.env.RESEND_API_KEY?.trim() || pass;
    const from = process.env.SMTP_FROM ?? "Jango <no-reply@expirymate.local>";

    if (!resendApiKey && (!host || !user || !pass)) {
      if (process.env.NODE_ENV === "production") {
        throw new ServiceUnavailableException(
          "메일 발송 설정이 아직 준비되지 않았어요.",
        );
      }

      this.logger.warn(
        `SMTP is not configured. Skipping mail to ${input.to}: ${input.subject}`,
      );
      return;
    }

    try {
      // Railway and many PaaS block outbound SMTP; Resend HTTP works over 443.
      if (shouldUseResendHttp(host, user, process.env.RESEND_API_KEY)) {
        await this.sendViaResendHttp({
          apiKey: resendApiKey!,
          from,
          to: input.to,
          subject: input.subject,
          text: input.text,
          html: input.html,
        });
        return;
      }

      await this.sendViaSmtp({
        host: host!,
        user: user!,
        pass: pass!,
        from,
        to: input.to,
        subject: input.subject,
        text: input.text,
        html: input.html,
      });
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }

      this.logger.error(
        `Failed to send mail to ${input.to}: ${input.subject}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new ServiceUnavailableException(
        "확인 메일을 보내지 못했어요. 잠시 뒤 다시 시도해 주세요.",
      );
    }
  }

  private async sendViaResendHttp(input: {
    apiKey: string;
    from: string;
    to: string;
    subject: string;
    text: string;
    html?: string;
  }) {
    const response = await fetchWithTimeout(
      "https://api.resend.com/emails",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${input.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: input.from,
          to: [input.to],
          subject: input.subject,
          text: input.text,
          html: input.html,
        }),
      },
      MAIL_TIMEOUT_MS,
    );

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      this.logger.error(
        `Resend API ${response.status}: ${detail.slice(0, 500)}`,
      );
      throw new ServiceUnavailableException(
        "확인 메일을 보내지 못했어요. 잠시 뒤 다시 시도해 주세요.",
      );
    }
  }

  private async sendViaSmtp(input: {
    host: string;
    user: string;
    pass: string;
    from: string;
    to: string;
    subject: string;
    text: string;
    html?: string;
  }) {
    const port = Number(process.env.SMTP_PORT ?? 587);
    const transporter = nodemailer.createTransport({
      host: input.host,
      port,
      secure: port === 465,
      auth: { user: input.user, pass: input.pass },
      connectionTimeout: MAIL_TIMEOUT_MS,
      greetingTimeout: MAIL_TIMEOUT_MS,
      socketTimeout: MAIL_TIMEOUT_MS,
    });

    await transporter.sendMail({
      from: input.from,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
    });
  }
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function shouldUseResendHttp(
  host: string | undefined,
  user: string | undefined,
  resendApiKey: string | undefined,
) {
  if (resendApiKey?.trim()) {
    return true;
  }

  return host === "smtp.resend.com" || user === "resend";
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new ServiceUnavailableException(
        "확인 메일을 보내지 못했어요. 잠시 뒤 다시 시도해 주세요.",
      );
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
