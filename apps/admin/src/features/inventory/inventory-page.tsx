"use client";

import { formatDateKoreanCompact } from "@expirymate/shared";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "../../components/page-header";
import { Panel } from "../../components/panel";
import { InventoryStatusPill, StoragePill } from "../../components/status-pill";
import { listInventory } from "../../lib/api";

const PAGE_SIZE = 50;

export function InventoryPage() {
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [page, setPage] = useState(1);

  const inventoryQuery = useQuery({
    queryKey: ["inventory-list", page, submittedQuery],
    queryFn: () =>
      listInventory({
        page,
        limit: PAGE_SIZE,
        q: submittedQuery || undefined,
      }),
  });

  const items = inventoryQuery.data?.items ?? [];
  const totalCount = inventoryQuery.data?.totalCount ?? 0;
  const hasMore = inventoryQuery.data?.hasMore ?? false;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Inventory"
        title="재고 조회"
        description="모바일 사용자 재고 상태를 내부에서 빠르게 확인하는 화면입니다."
        actions={
          <form
            className="flex w-full min-w-72 gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              setPage(1);
              setSubmittedQuery(query.trim());
            }}
          >
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="상품명 또는 브랜드 검색"
              className="w-full rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-2 text-sm outline-none"
            />
            <button
              type="submit"
              className="shrink-0 rounded-full bg-[var(--primary)] px-4 py-2 text-sm font-bold text-[var(--surface)]"
            >
              찾아보기
            </button>
          </form>
        }
      />

      <Panel
        title="재고 목록"
        description={`읽기 중심의 운영 확인용 화면입니다. 총 ${totalCount}건`}
      >
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="grid gap-4 rounded-[var(--radius-2xl)] border border-[var(--border)] bg-[var(--surface-muted)] p-4 lg:grid-cols-[minmax(0,1fr)_auto]"
            >
              <div>
                <div className="text-lg font-black">{item.displayName}</div>
                <div className="mt-1 text-sm text-[var(--muted)]">
                  {item.brand ?? "브랜드 없음"} · 수량 {item.quantity}
                  {item.unit ?? "개"}
                </div>
                <div className="mt-2 text-sm text-[var(--muted)]">
                  유통기한 {formatDateKoreanCompact(item.expiryDate)}
                </div>
              </div>
              <div className="flex flex-wrap items-start justify-end gap-2">
                <StoragePill location={item.storageLocation} />
                <InventoryStatusPill status={item.status} />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex items-center justify-between gap-3">
          <button
            type="button"
            disabled={page <= 1 || inventoryQuery.isFetching}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold disabled:opacity-40"
          >
            이전
          </button>
          <div className="text-sm text-[var(--muted)]">{page} 페이지</div>
          <button
            type="button"
            disabled={!hasMore || inventoryQuery.isFetching}
            onClick={() => setPage((current) => current + 1)}
            className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold disabled:opacity-40"
          >
            다음
          </button>
        </div>
      </Panel>
    </div>
  );
}
