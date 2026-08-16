import Link from "next/link";
import { appBrand } from "@expirymate/shared";

export default function NotFoundPage() {
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-5 py-10">
      <div className="rounded-[var(--radius-2xl)] border border-[var(--border)] bg-[var(--surface)] p-7 shadow-[var(--shadow-lift)]">
        <div className="inline-flex rounded-full bg-[var(--primary-soft)] px-3 py-1 text-sm font-bold text-[var(--primary)]">
          {appBrand.appNameKo}
        </div>
        <h1 className="mt-5 text-3xl font-black tracking-tight">
          이 페이지는 아직 없어요
        </h1>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
          주소를 다시 확인하거나, 공개 안내 페이지로 돌아가 주세요.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/partners"
            className="rounded-full bg-[var(--primary)] px-5 py-3 text-sm font-black text-[var(--surface)]"
          >
            쿠팡 파트너스 안내
          </Link>
          <Link
            href="/privacy"
            className="rounded-full bg-[var(--surface-muted)] px-5 py-3 text-sm font-black text-[var(--foreground)]"
          >
            개인정보처리방침
          </Link>
          <Link
            href="/terms"
            className="rounded-full bg-[var(--surface-muted)] px-5 py-3 text-sm font-black text-[var(--foreground)]"
          >
            이용약관
          </Link>
        </div>
      </div>
    </main>
  );
}
