"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "../../components/page-header";
import { Panel } from "../../components/panel";
import { lookupProductByBarcode, listUnknownScanLogs } from "../../lib/api";

export function BarcodesPage() {
  const [barcode, setBarcode] = useState("");
  const [submittedBarcode, setSubmittedBarcode] = useState<string | null>(null);

  const lookupQuery = useQuery({
    queryKey: ["barcode-lookup", submittedBarcode],
    queryFn: () => lookupProductByBarcode(submittedBarcode as string),
    enabled: Boolean(submittedBarcode),
  });
  const unknownLogsQuery = useQuery({
    queryKey: ["unknown-scan-logs"],
    queryFn: listUnknownScanLogs,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Barcodes"
        title="바코드 조회"
        description="실제 스캔 시 어떤 상품으로 매핑되는지 확인하고, 미매칭 로그를 추적합니다."
      />

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Panel title="바코드 즉시 조회" description="모바일 스캔과 같은 엔드포인트를 사용합니다.">
          <div className="space-y-4">
            <input
              value={barcode}
              onChange={(event) => setBarcode(event.target.value)}
              placeholder="예: 8801111111111"
              className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 outline-none"
            />
            <button
              type="button"
              onClick={() => setSubmittedBarcode(barcode)}
              className="rounded-full bg-[var(--primary)] px-4 py-3 text-sm font-bold text-white"
            >
              조회하기
            </button>

            {submittedBarcode ? (
              lookupQuery.data ? (
                <div className="rounded-[28px] bg-[var(--primary-soft)] p-5">
                  <div className="text-sm font-semibold text-[var(--primary)]">매칭 성공</div>
                  <div className="mt-2 text-2xl font-black">{lookupQuery.data.name}</div>
                  <div className="mt-2 text-sm text-[var(--muted)]">
                    {lookupQuery.data.brand} · {lookupQuery.data.barcode}
                  </div>
                </div>
              ) : (
                <div className="rounded-[28px] bg-[#fde7e1] p-5">
                  <div className="text-sm font-semibold text-[var(--danger)]">미매칭</div>
                  <div className="mt-2 text-sm leading-6">
                    상품을 찾을 수 없어요. 상품 관리 화면에서 새 레코드를 등록하세요.
                  </div>
                </div>
              )
            ) : null}
          </div>
        </Panel>

        <Panel title="최근 미매칭 로그" description="우선 등록이 필요한 바코드 후보입니다.">
          <div className="space-y-3">
            {unknownLogsQuery.data?.map((log) => (
              <div
                key={log.id}
                className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3"
              >
                <div className="font-mono font-semibold">{log.barcode}</div>
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
