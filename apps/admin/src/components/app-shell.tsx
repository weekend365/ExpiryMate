"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { PropsWithChildren } from "react";

const navItems = [
  { href: "/dashboard", label: "대시보드" },
  { href: "/products", label: "상품 관리" },
  { href: "/inventory", label: "재고 조회" },
  { href: "/seed-status", label: "시드 상태" },
];

export function AppShell({ children }: PropsWithChildren) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen">
      <div className="mx-auto grid min-h-screen max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[250px_minmax(0,1fr)]">
        <aside className="rounded-[28px] border border-[var(--border)] bg-[var(--surface)]/95 p-5 shadow-[0_24px_70px_rgba(29,39,32,0.08)] backdrop-blur">
          <div className="mb-8">
            <div className="inline-flex rounded-full bg-[var(--primary-soft)] px-3 py-1 text-sm font-semibold text-[var(--primary)]">
              ExpiryMate Admin
            </div>
            <h1 className="mt-4 text-2xl font-black tracking-tight">재료 기반 운영 관리</h1>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              기준 상품, 재고 상태, 요리 추천 준비 데이터를 한 곳에서 관리합니다.
            </p>
          </div>

          <nav className="space-y-2">
            {navItems.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`block rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                    isActive
                      ? "bg-[var(--primary)] text-white"
                      : "bg-[var(--surface-muted)] text-[var(--foreground)] hover:bg-[var(--primary-soft)]"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        <main className="rounded-[32px] border border-[var(--border)] bg-[var(--surface)]/92 p-6 shadow-[0_30px_80px_rgba(29,39,32,0.08)] backdrop-blur lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
