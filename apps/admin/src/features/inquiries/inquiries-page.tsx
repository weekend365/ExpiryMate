"use client";

import {
  SupportInquiryCategory,
  SupportInquiryStatus,
  formatDateKoreanCompact,
  supportInquiryCategoryLabels,
  supportInquiryStatusLabels,
  type SupportInquiry,
} from "@expirymate/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { PageHeader } from "../../components/page-header";
import { Panel } from "../../components/panel";
import {
  closeSupportInquiry,
  listSupportInquiries,
} from "../../lib/api";

const PAGE_SIZE = 20;

function buildMailto(inquiry: SupportInquiry) {
  const email = inquiry.userEmail?.trim();
  if (!email) {
    return null;
  }

  const subject = encodeURIComponent(
    `[장고야 부탁해] 문의 답변 · ${supportInquiryCategoryLabels[inquiry.category]}`,
  );
  const body = encodeURIComponent(
    [
      "안녕하세요, 장고예요.",
      "",
      "남겨 주신 문의에 답드려요.",
      "",
      `문의 ID: ${inquiry.id}`,
      "",
      "——",
      "",
    ].join("\n"),
  );

  return `mailto:${email}?subject=${subject}&body=${body}`;
}

export function InquiriesPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<SupportInquiryStatus | "">("");
  const [category, setCategory] = useState<SupportInquiryCategory | "">("");

  const listQuery = useQuery({
    queryKey: ["support-inquiries", page, status, category],
    queryFn: () =>
      listSupportInquiries({
        page,
        limit: PAGE_SIZE,
        status: status || undefined,
        category: category || undefined,
      }),
  });

  const closeMutation = useMutation({
    mutationFn: (id: string) => closeSupportInquiry(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["support-inquiries"] });
    },
  });

  const items = listQuery.data?.items ?? [];
  const totalCount = listQuery.data?.totalCount ?? 0;
  const hasMore = listQuery.data?.hasMore ?? false;

  const emptyCopy = useMemo(() => {
    if (listQuery.isLoading) {
      return "문의를 불러오는 중이에요.";
    }
    if (listQuery.isError) {
      return "앗, 문의를 불러오지 못했어요.";
    }
    return "아직 도착한 문의가 없어요.";
  }, [listQuery.isError, listQuery.isLoading]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Support"
        title="고객 문의"
        description="앱에서 보낸 문의를 확인하고, 메일로 답장해 주세요."
      />

      <Panel title="필터">
        <div className="flex flex-wrap gap-3">
          <label className="flex flex-col gap-1 text-sm font-semibold">
            상태
            <select
              className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
              value={status}
              onChange={(event) => {
                setPage(1);
                setStatus(event.target.value as SupportInquiryStatus | "");
              }}
            >
              <option value="">전체</option>
              {Object.values(SupportInquiryStatus).map((value) => (
                <option key={value} value={value}>
                  {supportInquiryStatusLabels[value]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold">
            주제
            <select
              className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
              value={category}
              onChange={(event) => {
                setPage(1);
                setCategory(event.target.value as SupportInquiryCategory | "");
              }}
            >
              <option value="">전체</option>
              {Object.values(SupportInquiryCategory).map((value) => (
                <option key={value} value={value}>
                  {supportInquiryCategoryLabels[value]}
                </option>
              ))}
            </select>
          </label>
        </div>
      </Panel>

      <Panel title={`목록 · ${totalCount}건`}>
        {items.length === 0 ? (
          <p className="text-sm font-semibold text-[var(--muted)]">{emptyCopy}</p>
        ) : (
          <ul className="space-y-4">
            {items.map((inquiry) => {
              const mailto = buildMailto(inquiry);
              return (
                <li
                  key={inquiry.id}
                  className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface-muted)] p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="text-sm font-black text-[var(--foreground)]">
                        {supportInquiryCategoryLabels[inquiry.category]} ·{" "}
                        {supportInquiryStatusLabels[inquiry.status]}
                      </div>
                      <div className="text-xs font-semibold text-[var(--muted)]">
                        {formatDateKoreanCompact(inquiry.createdAt)} ·{" "}
                        {inquiry.userEmail ?? inquiry.userId}
                        {inquiry.platform ? ` · ${inquiry.platform}` : ""}
                        {inquiry.appVersion ? ` · v${inquiry.appVersion}` : ""}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {mailto ? (
                        <a
                          className="rounded-full bg-[var(--primary)] px-4 py-2 text-sm font-bold text-[var(--surface)]"
                          href={mailto}
                        >
                          메일로 답장
                        </a>
                      ) : null}
                      {inquiry.status === SupportInquiryStatus.OPEN ? (
                        <button
                          type="button"
                          className="rounded-full bg-[var(--surface)] px-4 py-2 text-sm font-bold text-[var(--foreground)]"
                          disabled={closeMutation.isPending}
                          onClick={() => closeMutation.mutate(inquiry.id)}
                        >
                          마무리할게요
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[var(--foreground)]">
                    {inquiry.body}
                  </p>
                </li>
              );
            })}
          </ul>
        )}

        <div className="mt-6 flex items-center justify-between gap-3">
          <button
            type="button"
            className="rounded-full bg-[var(--surface)] px-4 py-2 text-sm font-bold disabled:opacity-40"
            disabled={page <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            이전
          </button>
          <span className="text-sm font-semibold text-[var(--muted)]">
            {page}페이지
          </span>
          <button
            type="button"
            className="rounded-full bg-[var(--surface)] px-4 py-2 text-sm font-bold disabled:opacity-40"
            disabled={!hasMore}
            onClick={() => setPage((current) => current + 1)}
          >
            다음
          </button>
        </div>
      </Panel>
    </div>
  );
}
