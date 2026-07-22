"use client";

import { appBrand } from "@expirymate/shared";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { PropsWithChildren } from "react";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminLogout, getMe } from "../lib/api";

const navItems = [
  { href: "/dashboard", label: "대시보드" },
  { href: "/products", label: "상품 관리" },
  { href: "/inventory", label: "재고 조회" },
  { href: "/seed-status", label: "시드 상태" },
];

export function AppShell({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const router = useRouter();
  const isPublicPage = pathname === "/login" || pathname.startsWith("/privacy");
  const meQuery = useQuery({
    queryKey: ["admin", "me"],
    queryFn: getMe,
    enabled: !isPublicPage,
  });

  useEffect(() => {
    if (!isPublicPage && meQuery.isError) {
      router.replace("/login");
    }
  }, [isPublicPage, meQuery.isError, router]);

  if (isPublicPage) {
    return <>{children}</>;
  }

  if (meQuery.isLoading) {
    return (
      <div className="grid min-h-screen place-items-center text-sm font-semibold text-[var(--muted)]">
        관리자 권한을 잠깐 살펴보는 중이에요.
      </div>
    );
  }

  if (meQuery.data?.role !== "admin") {
    return (
      <div className="grid min-h-screen place-items-center px-4">
        <div className="rounded-[var(--radius-2xl)] border border-[var(--border)] bg-[var(--surface)] p-8 text-center shadow-[var(--shadow-soft)]">
          <div className="text-xl font-black">관리자만 들어올 수 있어요</div>
          <button
            className="mt-6 rounded-full bg-[var(--primary)] px-5 py-3 text-sm font-bold text-[var(--surface)]"
            onClick={() => {
              adminLogout().finally(() => router.replace("/login"));
            }}
          >
            다시 들어가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="mx-auto grid min-h-screen max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[250px_minmax(0,1fr)]">
        <aside className="rounded-[var(--radius-2xl)] border border-[var(--border)] bg-[var(--surface)]/95 p-5 shadow-[var(--shadow-soft)] backdrop-blur">
          <div className="mb-8">
            <div className="inline-flex rounded-full bg-[var(--primary-soft)] px-3 py-1 text-sm font-semibold text-[var(--primary)]">
              {appBrand.appNameKo} Admin
            </div>
            <h1 className="mt-4 text-2xl font-black tracking-tight">재료 기반 운영 관리</h1>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              기준 상품, 재고 상태, 요리 추천 준비 데이터를 한 곳에서 관리합니다.
            </p>
            <button
              className="mt-4 rounded-full bg-[var(--surface-muted)] px-3 py-2 text-sm font-bold text-[var(--foreground)]"
              onClick={() => {
                adminLogout().finally(() => router.replace("/login"));
              }}
            >
              여기서 나갈게요
            </button>
          </div>

          <nav className="space-y-2">
            {navItems.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`block rounded-[var(--radius-lg)] px-4 py-3 text-sm font-semibold transition ${
                    isActive
                      ? "bg-[var(--primary)] text-[var(--surface)]"
                      : "bg-[var(--surface-muted)] text-[var(--foreground)] hover:bg-[var(--primary-soft)]"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        <main className="rounded-[var(--radius-2xl)] border border-[var(--border)] bg-[var(--surface)]/92 p-6 shadow-[var(--shadow-lift)] backdrop-blur lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
