"use client";

import { formatDateKoreanCompact } from "@expirymate/shared";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { PageHeader } from "../../components/page-header";
import { Panel } from "../../components/panel";
import { InventoryStatusPill, StoragePill } from "../../components/status-pill";
import { listInventory } from "../../lib/api";

export function InventoryPage() {
  const [query, setQuery] = useState("");
  const inventoryQuery = useQuery({
    queryKey: ["inventory-list"],
    queryFn: listInventory,
  });

  const filtered = useMemo(() => {
    const items = inventoryQuery.data ?? [];
    if (!query) {
      return items;
    }

    return items.filter((item) =>
      `${item.displayName} ${item.brand ?? ""}`
        .toLowerCase()
        .includes(query.toLowerCase()),
    );
  }, [inventoryQuery.data, query]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Inventory"
        title="재고 조회"
        description="모바일 사용자 재고 상태를 내부에서 빠르게 확인하는 화면입니다."
        actions={
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="상품명 또는 브랜드 검색"
            className="w-full min-w-72 rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-2 text-sm outline-none"
          />
        }
      />

      <Panel title="재고 목록" description="읽기 중심의 운영 확인용 화면입니다.">
        <div className="space-y-3">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="grid gap-4 rounded-[28px] border border-[var(--border)] bg-[var(--surface-muted)] p-4 lg:grid-cols-[minmax(0,1fr)_auto]"
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
      </Panel>
    </div>
  );
}
