"use client";

import {
  ProductMasterSource,
  productMasterSourceLabels,
} from "@expirymate/shared";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo, useState } from "react";
import { PageHeader } from "../../components/page-header";
import { Panel } from "../../components/panel";
import { StatusPill } from "../../components/status-pill";
import { listProductMasters } from "../../lib/api";

const PAGE_SIZE = 50;

const sourceOptions = [
  { value: "", label: "모든 출처" },
  ...Object.values(ProductMasterSource).map((value) => ({
    value,
    label: productMasterSourceLabels[value],
  })),
];

export function ProductMastersPage() {
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [source, setSource] = useState("");
  const [pendingOnly, setPendingOnly] = useState(true);
  const [page, setPage] = useState(1);

  const catalogQuery = useQuery({
    queryKey: [
      "product-masters",
      page,
      submittedQuery,
      source,
      pendingOnly,
    ],
    queryFn: () =>
      listProductMasters({
        page,
        limit: PAGE_SIZE,
        q: submittedQuery || undefined,
        source: source || undefined,
        hasPendingCorrections: pendingOnly,
      }),
  });

  const items = useMemo(
    () => catalogQuery.data?.items ?? [],
    [catalogQuery.data],
  );
  const totalCount = catalogQuery.data?.totalCount ?? 0;
  const hasMore = catalogQuery.data?.hasMore ?? false;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Barcode Catalog"
        title="바코드 목록"
        description="스캔에 쓰는 전역 상품 이름이에요. 사용자 수정 제안은 여기서 살펴봐요."
        actions={
          <form
            className="flex w-full min-w-72 flex-wrap gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              setPage(1);
              setSubmittedQuery(query.trim());
            }}
          >
            <input
              aria-label="바코드, 상품명 또는 브랜드 검색"
              name="product-master-search"
              autoComplete="off"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="바코드, 상품명 또는 브랜드…"
              className="w-full min-w-64 rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-2 text-sm outline-none"
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
        title="살펴볼 목록"
        description={`총 ${totalCount}건`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="출처 필터"
              value={source}
              onChange={(event) => {
                setPage(1);
                setSource(event.target.value);
              }}
              className="rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-2 text-sm outline-none"
            >
              {sourceOptions.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => {
                setPage(1);
                setPendingOnly((current) => !current);
              }}
              className="rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-2 text-sm font-bold"
            >
              {pendingOnly ? "전체 보기" : "수정 제안만 보기"}
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          {items.map((product) => (
            <Link
              key={product.id}
              href={`/product-masters/${product.id}`}
              className="block rounded-[var(--radius-2xl)] border border-[var(--border)] bg-[var(--surface-muted)] p-4 transition hover:-translate-y-0.5"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-lg font-black">{product.name}</div>
                  <div className="mt-1 text-sm text-[var(--muted)]">
                    {product.brand} · {product.barcode}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <StatusPill
                    label={
                      productMasterSourceLabels[
                        product.source as ProductMasterSource
                      ] ?? product.source
                    }
                  />
                  {product.pendingCorrectionCount > 0 ? (
                    <StatusPill
                      tone="warning"
                      label={`살펴볼 제안 ${product.pendingCorrectionCount}건`}
                    />
                  ) : null}
                </div>
              </div>
            </Link>
          ))}
          {items.length === 0 ? (
            <div className="rounded-[var(--radius-2xl)] bg-[var(--surface-muted)] p-5 text-sm text-[var(--muted)]">
              {pendingOnly
                ? "아직 살펴볼 수정 제안이 없어요."
                : "조건에 맞는 바코드 상품이 없어요."}
            </div>
          ) : null}
        </div>
        {totalCount > PAGE_SIZE ? (
          <div className="mt-4 flex items-center justify-between gap-3">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-bold disabled:opacity-40"
            >
              이전
            </button>
            <div className="text-sm text-[var(--muted)]">{page}페이지</div>
            <button
              type="button"
              disabled={!hasMore}
              onClick={() => setPage((current) => current + 1)}
              className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-bold disabled:opacity-40"
            >
              다음
            </button>
          </div>
        ) : null}
      </Panel>
    </div>
  );
}
