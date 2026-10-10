import { UnauthorizedException } from "@nestjs/common";
import { LoginTicket, OAuth2Client, type TokenPayload } from "google-auth-library";
import { afterEach, describe, expect, it, vi } from "vitest";
import { verifyGooglePubSubPushIdentity } from "./google-pubsub-auth";

const audience = "https://api.example.com/subscriptions/notifications/google";
const email = "rtdn-push@example.iam.gserviceaccount.com";
const payload: TokenPayload = {
  iss: "https://accounts.google.com",
  sub: "test-push-service-account",
  aud: audience,
  iat: 100,
  exp: 200,
  email,
  email_verified: true,
};

describe("Google Pub/Sub push identity", () => {
  afterEach(() => vi.restoreAllMocks());

  it("accepts the verified configured account after SDK audience verification", async () => {
    const verify = vi.spyOn(OAuth2Client.prototype, "verifyIdToken")
      .mockImplementation(async () => new LoginTicket("test-envelope", payload));

    await expect(verifyGooglePubSubPushIdentity("test-token", audience, email))
      .resolves.toBeUndefined();
    expect(verify).toHaveBeenCalledWith({ idToken: "test-token", audience });
  });

  it.each([
    { label: "another Google service account", change: { email: "other@example.iam.gserviceaccount.com" } },
    { label: "a user account", change: { email: "user@example.com" } },
    { label: "an absent email", change: { email: undefined } },
    { label: "an unverified email", change: { email_verified: false } },
    { label: "an absent verification claim", change: { email_verified: undefined } },
  ])("rejects $label even when signature and audience verification passed", async ({ change }) => {
    vi.spyOn(OAuth2Client.prototype, "verifyIdToken")
      .mockImplementation(async () => new LoginTicket("test-envelope", { ...payload, ...change }));

    await expect(verifyGooglePubSubPushIdentity("test-token", audience, email))
      .rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("rejects an absent decoded payload", async () => {
    vi.spyOn(OAuth2Client.prototype, "verifyIdToken")
      .mockImplementation(async () => new LoginTicket());
    await expect(verifyGooglePubSubPushIdentity("test-token", audience, email))
      .rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("returns a safe 401 when SDK signature, audience or expiry validation fails", async () => {
    vi.spyOn(OAuth2Client.prototype, "verifyIdToken")
      .mockRejectedValue(new Error("secret token test-token failed SDK verification"));
    await expect(verifyGooglePubSubPushIdentity("test-token", audience, email))
      .rejects.toThrow("Google 알림 인증을 확인할 수 없습니다.");
  });
});
