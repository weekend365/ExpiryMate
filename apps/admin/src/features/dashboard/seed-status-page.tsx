"use client";

import { useQueries } from "@tanstack/react-query";
import { PageHeader } from "../../components/page-header";
import { MetricCard } from "../../components/metric-card";
import { Panel } from "../../components/panel";
import { getDashboardSummary, listInventory, listProducts } from "../../lib/api";

export function SeedStatusPage() {
  const [productsQuery, inventoryQuery, summaryQuery] = useQueries({
    queries: [
      { queryKey: ["products", "seed-status"], queryFn: () => listProducts() },
      { queryKey: ["inventory", "seed-status"], queryFn: () => listInventory({ limit: 1 }) },
      { queryKey: ["dashboard-summary", "seed-status"], queryFn: getDashboardSummary },
    ],
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Seed"
        title="개발 시드 상태"
        description="로컬 개발 데이터가 정상적으로 들어갔는지 확인하는 단순한 점검 화면입니다."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="시드 상품 수" value={productsQuery.data?.length ?? 0} />
        <MetricCard label="시드 재고 수" value={inventoryQuery.data?.totalCount ?? 0} />
        <MetricCard label="보관 중" value={summaryQuery.data?.totalActiveCount ?? 0} />
        <MetricCard label="오늘 만료 수" value={summaryQuery.data?.todayExpiryCount ?? 0} tone="danger" />
      </div>

      <Panel title="초기 확인 포인트" description="MVP 기준에서 다음 값이면 정상입니다.">
        <ul className="list-disc space-y-2 pl-5 text-sm leading-7 text-[var(--muted)]">
          <li>상품 10개 이상</li>
          <li>재고 8개 이상</li>
          <li>오늘 만료, 3일 이내 만료, 만료 상태가 모두 섞여 있음</li>
          <li>요리 추천에 활용할 냉장, 냉동, 실온 재료가 섞여 있음</li>
        </ul>
      </Panel>
    </div>
  );
}
