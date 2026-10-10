import { UnauthorizedException } from "@nestjs/common";
import { OAuth2Client } from "google-auth-library";

export async function verifyGooglePubSubPushIdentity(
  idToken: string,
  audience: string,
  expectedServiceAccountEmail: string,
): Promise<void> {
  const ticket = await new OAuth2Client()
    .verifyIdToken({ idToken, audience })
    .catch(() => {
      throw new UnauthorizedException("Google 알림 인증을 확인할 수 없습니다.");
    });
  const payload = ticket.getPayload();
  if (
    payload?.email !== expectedServiceAccountEmail ||
    payload.email_verified !== true
  ) {
    throw new UnauthorizedException("허용되지 않은 Google 알림 발신자입니다.");
  }
}
