"use client";

import { appBrand } from "@expirymate/shared";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
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
    <main className="grid min-h-screen place-items-center px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-[var(--radius-2xl)] border border-[var(--border)] bg-[var(--surface)] p-8 shadow-[var(--shadow-lift)]"
      >
        <div className="inline-flex rounded-full bg-[var(--primary-soft)] px-3 py-1 text-sm font-semibold text-[var(--primary)]">
          {appBrand.appNameKo} Admin
        </div>
        <h1 className="mt-6 text-3xl font-black tracking-tight">관리자로 들어올게요</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
          관리자 권한이 있는 이메일 계정으로 들어와 주세요.
        </p>

        <div className="mt-8 space-y-4">
          <input
            name="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            placeholder="이메일"
            className="h-12 w-full rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-muted)] px-4 text-sm outline-none"
          />
          <input
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            placeholder="비밀번호"
            className="h-12 w-full rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-muted)] px-4 text-sm outline-none"
          />
        </div>

        {errorMessage ? (
          <div className="mt-4 rounded-[var(--radius-lg)] bg-[var(--danger-soft)] px-4 py-3 text-sm font-semibold text-[var(--danger)]">
            {errorMessage}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={!email || !password || isSubmitting}
          className="mt-6 h-12 w-full rounded-[var(--radius-lg)] bg-[var(--primary)] text-sm font-black text-[var(--surface)] disabled:cursor-not-allowed disabled:bg-[var(--border)]"
        >
          {isSubmitting ? "들어가는 중이에요" : "들어갈게요"}
        </button>
      </form>
    </main>
  );
}
