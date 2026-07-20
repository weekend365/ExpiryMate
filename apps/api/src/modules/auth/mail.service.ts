import { Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import nodemailer from "nodemailer";
import { buildAuthHttpsLink } from "./app-links";

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

  private async sendMail(input: {
    to: string;
    subject: string;
    text: string;
    html?: string;
  }) {
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT ?? 587);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const from = process.env.SMTP_FROM ?? "Jango <no-reply@expirymate.local>";

    if (!host || !user || !pass) {
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

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });

    await transporter.sendMail({
      from,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
    });
  }
}
