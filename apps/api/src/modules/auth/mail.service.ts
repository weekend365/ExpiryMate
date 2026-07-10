import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { appBrand } from "@expirymate/shared";
import nodemailer from "nodemailer";

type MailMessage = { to: string; subject: string; text: string };

type SmtpConfig = {
  host: string;
  port: number;
  user?: string;
  pass?: string;
  from: string;
};

@Injectable()
export class MailService {
  async sendEmailVerification(email: string, token: string) {
    const url = `${getBaseUrl()}/auth/verify-email?token=${encodeURIComponent(token)}`;

    await this.send({
      to: email,
      subject: `${appBrand.appNameKo} 이메일을 인증해주세요`,
      text: `${appBrand.appNameKo} 이메일 인증 링크입니다.\n\n${url}`,
    });
  }

  async sendPasswordReset(email: string, token: string) {
    const url = `${getBaseUrl()}/auth/reset-password?token=${encodeURIComponent(token)}`;

    await this.send({
      to: email,
      subject: `${appBrand.appNameKo} 비밀번호 재설정`,
      text: `${appBrand.appNameKo} 비밀번호 재설정 링크입니다. 15분 안에 사용해주세요.\n\n${url}`,
    });
  }

  private async send(message: MailMessage) {
    const config = getSmtpConfig();
    const resendApiKey = getResendApiKey(config);

    if (!config) {
      if (process.env.NODE_ENV === "production") {
        throw new ServiceUnavailableException("SMTP 환경변수가 설정되지 않았습니다.");
      }

      console.log(`[${appBrand.appNameEn} mail:dev] to=${message.to}`);
      console.log(`[${appBrand.appNameEn} mail:dev] subject=${message.subject}`);
      console.log(message.text);
      return;
    }

    if (resendApiKey) {
      await sendViaResendApi(config.from, resendApiKey, message);
      return;
    }

    await sendViaSmtp(config, message);
  }
}

async function sendViaResendApi(from: string, apiKey: string, message: MailMessage) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [message.to],
      subject: message.subject,
      text: message.text,
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new ServiceUnavailableException(`메일 발송에 실패했습니다: ${body}`);
  }
}

async function sendViaSmtp(config: SmtpConfig, message: MailMessage) {
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    requireTLS: config.port === 587,
    auth: config.user
      ? {
          user: config.user,
          pass: config.pass,
        }
      : undefined,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });

  try {
    await transporter.sendMail({
      from: config.from,
      ...message,
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown SMTP error";
    throw new ServiceUnavailableException(`메일 발송에 실패했습니다: ${reason}`);
  }
}

function getSmtpConfig(): SmtpConfig | null {
  const host = process.env.SMTP_HOST;
  const from = process.env.SMTP_FROM;

  if (!host || !from) {
    return null;
  }

  return {
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from,
  };
}

function getResendApiKey(config: SmtpConfig | null) {
  const explicitKey = process.env.RESEND_API_KEY?.trim();
  if (explicitKey) {
    return explicitKey;
  }

  const pass = config?.pass?.trim();
  const host = config?.host.trim().toLowerCase() ?? "";

  if (host === "smtp.resend.com" && pass?.startsWith("re_")) {
    return pass;
  }

  return null;
}

function getBaseUrl() {
  return process.env.APP_BASE_URL ?? "expirymate://";
}
