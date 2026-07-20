import { afterEach, describe, expect, it, vi } from "vitest";
import { MailService } from "./mail.service";

describe("MailService", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    delete process.env.SMTP_FROM;
    delete process.env.RESEND_API_KEY;
    delete process.env.AUTH_LINK_BASE_URL;
    delete process.env.APP_BASE_URL;
  });

  it("sends verification mail through Resend HTTP when SMTP host is Resend", async () => {
    process.env.SMTP_HOST = "smtp.resend.com";
    process.env.SMTP_USER = "resend";
    process.env.SMTP_PASS = "re_test_key";
    process.env.SMTP_FROM = "noreply@mail.devnamu.com";
    process.env.AUTH_LINK_BASE_URL = "https://api.example.com";

    const fetchMock = vi.fn<typeof fetch>(async () =>
      new Response(JSON.stringify({ id: "email_1" }), { status: 200 }),
    );
    globalThis.fetch = fetchMock;

    const service = new MailService();
    await service.sendEmailVerification("user@example.com", "tok");

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.resend.com/emails");
    expect(init).toMatchObject({
      method: "POST",
      headers: expect.objectContaining({
        Authorization: "Bearer re_test_key",
      }),
    });

    const body = JSON.parse(String((init as RequestInit).body));
    expect(body.to).toEqual(["user@example.com"]);
    expect(body.html).toContain(
      "https://api.example.com/auth/verify-email?token=tok",
    );
  });
});
