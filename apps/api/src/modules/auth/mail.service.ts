import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import nodemailer from "nodemailer";

@Injectable()
export class MailService {
  async sendEmailVerification(email: string, token: string) {
    const url = `${getBaseUrl()}/auth/verify-email?token=${encodeURIComponent(token)}`;

    await this.send({
      to: email,
      subject: "ExpiryMate 이메일을 인증해주세요",
      text: `ExpiryMate 이메일 인증 링크입니다.\n\n${url}`,
    });
  }

  async sendPasswordReset(email: string, token: string) {
    const url = `${getBaseUrl()}/auth/reset-password?token=${encodeURIComponent(token)}`;

    await this.send({
      to: email,
      subject: "ExpiryMate 비밀번호 재설정",
      text: `ExpiryMate 비밀번호 재설정 링크입니다. 15분 안에 사용해주세요.\n\n${url}`,
    });
  }

  private async send(message: { to: string; subject: string; text: string }) {
    const config = getSmtpConfig();

    if (!config) {
      if (process.env.NODE_ENV === "production") {
        throw new ServiceUnavailableException("SMTP 환경변수가 설정되지 않았습니다.");
      }

      console.log(`[ExpiryMate mail:dev] to=${message.to}`);
      console.log(`[ExpiryMate mail:dev] subject=${message.subject}`);
      console.log(message.text);
      return;
    }

    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.port === 465,
      auth: config.user
        ? {
            user: config.user,
            pass: config.pass,
          }
        : undefined,
    });

    await transporter.sendMail({
      from: config.from,
      ...message,
    });
  }
}

function getSmtpConfig() {
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

function getBaseUrl() {
  return process.env.APP_BASE_URL ?? "expirymate://";
}
