"use client";

import { appBrand } from "@expirymate/shared";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { PropsWithChildren } from "react";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminLogout, getMe } from "../lib/api";
import { ActionButton } from "./action-control";

const navItems = [
  { href: "/dashboard", label: "대시보드" },
  { href: "/monetization", label: "수익화" },
  { href: "/products", label: "상품 관리" },
  { href: "/product-masters", label: "바코드 목록" },
  { href: "/inventory", label: "재고 조회" },
  { href: "/inquiries", label: "고객 문의" },
  { href: "/seed-status", label: "시드 상태" },
];

function isAdminRoute(pathname: string) {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  if (normalized === "/") {
    return true;
  }
  return navItems.some(
    (item) =>
      normalized === item.href || normalized.startsWith(`${item.href}/`),
  );
}

export function AppShell({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const router = useRouter();
  const isPublicPage = !isAdminRoute(pathname);
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
      <div className="grid min-h-screen place-items-center type-body-small-strong text-[var(--muted)]">
        관리자 권한을 잠깐 살펴보는 중이에요.
      </div>
    );
  }

  if (meQuery.data?.role !== "admin") {
    return (
      <div className="grid min-h-screen place-items-center px-[var(--space-sm)]">
        <div className="rounded-[var(--radius-2xl)] border border-[var(--border)] bg-[var(--surface)] p-[var(--space-lg)] text-center shadow-[var(--shadow-soft)]">
          <div className="type-heading">관리자만 들어올 수 있어요</div>
          <ActionButton
            className="mt-[var(--space-md)]"
            size="medium"
            onClick={() => {
              adminLogout().finally(() => router.replace("/login"));
            }}
          >
            로그인으로 이동
          </ActionButton>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="mx-auto grid min-h-screen max-w-[var(--content-admin)] gap-[var(--space-md)] px-[var(--space-sm)] py-[var(--space-md)] lg:grid-cols-[250px_minmax(0,1fr)]">
        <aside className="rounded-[var(--radius-2xl)] border border-[var(--border)] bg-[var(--surface)]/95 p-[var(--space-md)] shadow-[var(--shadow-soft)] backdrop-blur">
          <div className="mb-[var(--space-lg)]">
            <div className="inline-flex rounded-full bg-[var(--primary-soft)] px-[var(--space-sm)] py-[var(--space-xxs)] type-body-small-strong text-[var(--primary-foreground)]">
              {appBrand.appNameKo} Admin
            </div>
            <h1 className="mt-[var(--space-sm)] type-title">재료 기반 운영 관리</h1>
            <p className="mt-[var(--space-xs)] type-body-small text-[var(--muted)]">
              기준 상품, 재고 상태, 요리 추천 준비 데이터를 한 곳에서 관리합니다.
            </p>
            <ActionButton
              className="mt-[var(--space-sm)]"
              variant="surface"
              onClick={() => {
                adminLogout().finally(() => router.replace("/login"));
              }}
            >
              로그아웃
            </ActionButton>
          </div>

          <nav className="space-y-[var(--space-xs)]">
            {navItems.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`type-body-small-strong flex min-h-[var(--control-minimum)] items-center rounded-[var(--radius-lg)] px-[var(--space-sm)] transition-colors duration-[var(--motion-fast)] ${isActive
                      ? "bg-[var(--action-primary-background)] text-[var(--surface)]"
                      : "bg-[var(--surface-muted)] text-[var(--foreground)] hover:bg-[var(--primary-soft)]"
                    }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        <main className="rounded-[var(--radius-2xl)] border border-[var(--border)] bg-[var(--surface)]/92 p-[var(--space-md)] shadow-[var(--shadow-lift)] backdrop-blur lg:p-[var(--space-lg)]">
          {children}
        </main>
      </div>
    </div>
  );
}
