"use client";

import { appBrand } from "@expirymate/shared";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { ActionButton } from "../../src/components/action-control";
import { adminLogin, adminLogout } from "../../src/lib/api";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const submittedEmail = String(formData.get("email") ?? email).trim();
    const submittedPassword = String(formData.get("password") ?? password);

    try {
      const session = await adminLogin({
        email: submittedEmail,
        password: submittedPassword,
      });
      if (session.user.role !== "admin") {
        await adminLogout();
        setErrorMessage("관리자만 들어올 수 있어요. 관리자 계정으로 다시 들어와 주세요.");
        return;
      }
      router.replace("/dashboard");
    } catch (error) {
      await adminLogout().catch(() => null);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "앗, 들어오는 중에 잠시 문제가 생겼어요.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="grid min-h-screen place-items-center px-[var(--space-sm)]">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-[var(--content-form)] rounded-[var(--radius-2xl)] border border-[var(--border)] bg-[var(--surface)] p-[var(--space-lg)] shadow-[var(--shadow-lift)]"
      >
        <div className="inline-flex rounded-full bg-[var(--primary-soft)] px-[var(--space-sm)] py-[var(--space-xxs)] type-body-small-strong text-[var(--primary-foreground)]">
          {appBrand.appNameKo} Admin
        </div>
        <h1 className="mt-[var(--space-md)] type-display">관리자로 들어올게요</h1>
        <p className="mt-[var(--space-xs)] type-body-small text-[var(--muted)]">
          관리자 권한이 있는 이메일 계정으로 들어와 주세요.
        </p>

        <div className="mt-[var(--space-lg)] space-y-[var(--space-sm)]">
          <label className="grid gap-[var(--space-xs)] type-body-small-strong">
            이메일
            <input
              name="email"
              autoComplete="email"
              spellCheck={false}
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              placeholder="admin@example.com"
              className="min-h-[var(--control-minimum)] w-full rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-muted)] px-[var(--space-sm)] type-body-small outline-none"
            />
          </label>
          <label className="grid gap-[var(--space-xs)] type-body-small-strong">
            비밀번호
            <input
              name="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              placeholder="비밀번호"
              className="min-h-[var(--control-minimum)] w-full rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-muted)] px-[var(--space-sm)] type-body-small outline-none"
            />
          </label>
        </div>

        {errorMessage ? (
          <div
            role="alert"
            aria-live="polite"
            className="mt-[var(--space-sm)] rounded-[var(--radius-lg)] bg-[var(--danger-soft)] px-[var(--space-sm)] py-[var(--space-sm)] type-body-small-strong text-[var(--danger-foreground)]"
          >
            {errorMessage}
          </div>
        ) : null}

        <ActionButton
          type="submit"
          disabled={!email || !password || isSubmitting}
          className="mt-[var(--space-md)]"
          size="medium"
          fullWidth
        >
          {isSubmitting ? "로그인 중…" : "로그인"}
        </ActionButton>
      </form>
    </main>
  );
}
