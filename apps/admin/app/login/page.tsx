"use client";

import { appBrand } from "@expirymate/shared";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { adminLogin } from "../../src/lib/api";

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
        setErrorMessage("관리자 권한이 필요합니다.");
        return;
      }
      router.replace("/dashboard");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "로그인에 실패했습니다.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="grid min-h-screen place-items-center px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-[32px] border border-[var(--border)] bg-[var(--surface)] p-8 shadow-[0_30px_80px_rgba(29,39,32,0.08)]"
      >
        <div className="inline-flex rounded-full bg-[var(--primary-soft)] px-3 py-1 text-sm font-semibold text-[var(--primary)]">
          {appBrand.appNameKo} Admin
        </div>
        <h1 className="mt-5 text-3xl font-black tracking-tight">관리자 로그인</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
          관리자 권한이 있는 이메일 계정으로 로그인하세요.
        </p>

        <div className="mt-8 space-y-3">
          <input
            name="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            placeholder="이메일"
            className="h-12 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 text-sm outline-none"
          />
          <input
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            placeholder="비밀번호"
            className="h-12 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 text-sm outline-none"
          />
        </div>

        {errorMessage ? (
          <div className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {errorMessage}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={!email || !password || isSubmitting}
          className="mt-6 h-12 w-full rounded-2xl bg-[var(--primary)] text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-[var(--border)]"
        >
          {isSubmitting ? "로그인 중" : "로그인"}
        </button>
      </form>
    </main>
  );
}
