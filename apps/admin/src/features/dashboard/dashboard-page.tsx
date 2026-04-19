"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "../../components/page-header";
import { MetricCard } from "../../components/metric-card";
import { Panel } from "../../components/panel";
import { InventoryStatusPill } from "../../components/status-pill";
import { getDashboardSummary, listUnknownScanLogs } from "../../lib/api";

export function DashboardPage() {
  const summaryQuery = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: getDashboardSummary,
  });
  const unknownLogsQuery = useQuery({
    queryKey: ["unknown-scan-logs"],
    queryFn: listUnknownScanLogs,
  });

  const summary = summaryQuery.data;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Overview"
        title="운영 대시보드"
        description="오늘 만료 수, 임박 수, 최근 등록 내역과 미매칭 바코드 현황을 빠르게 확인합니다."
        actions={
          <>
            <Link
              href="/products"
              className="rounded-full bg-[var(--primary)] px-4 py-2 text-sm font-bold text-white"
            >
              상품 관리
            </Link>
            <Link
              href="/barcodes"
              className="rounded-full bg-[var(--surface-muted)] px-4 py-2 text-sm font-bold"
            >
              바코드 조회
            </Link>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="오늘 만료" value={summary?.todayExpiryCount ?? 0} tone="danger" />
        <MetricCard label="3일 이내 만료" value={summary?.within3DaysCount ?? 0} tone="warning" />
        <MetricCard label="7일 이내 만료" value={summary?.within7DaysCount ?? 0} />
        <MetricCard label="미매칭 바코드" value={unknownLogsQuery.data?.length ?? 0} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Panel title="최근 등록한 상품" description="모바일에서 가장 최근에 등록된 재고입니다.">
          <div className="space-y-3">
            {summary?.recentItems?.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-2xl bg-[var(--surface-muted)] px-4 py-3"
              >
                <div>
                  <div className="font-bold">{item.displayName}</div>
                  <div className="mt-1 text-sm text-[var(--muted)]">{item.brand ?? "브랜드 없음"}</div>
                </div>
                <InventoryStatusPill status={item.status} />
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="미매칭 바코드 로그" description="향후 상품 매핑이 필요한 최근 스캔 기록입니다.">
          <div className="space-y-3">
            {unknownLogsQuery.data?.map((log) => (
              <div
                key={log.id}
                className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3"
              >
                <div className="font-mono text-sm font-semibold">{log.barcode}</div>
                <div className="mt-1 text-sm text-[var(--muted)]">
                  {new Date(log.createdAt).toLocaleString("ko-KR")}
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
