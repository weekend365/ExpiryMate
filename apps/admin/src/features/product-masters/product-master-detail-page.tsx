"use client";

import {
  ProductMasterCorrectionStatus,
  ProductMasterSource,
  catalogConfidenceLabel,
  catalogNeedsNameConfirmation,
  fieldLimits,
  productMasterCorrectionStatusLabels,
  productMasterSourceLabels,
} from "@expirymate/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { PageHeader } from "../../components/page-header";
import { Panel } from "../../components/panel";
import { StatusPill } from "../../components/status-pill";
import {
  applyProductMasterCorrection,
  dismissProductMasterCorrection,
  getProductMaster,
  updateProductMaster,
} from "../../lib/api";

const productMasterFormSchema = z.object({
  name: z.string().trim().min(1).max(fieldLimits.displayName),
  brand: z.string().trim().min(1).max(fieldLimits.brand),
  category: z.string().trim().min(1).max(fieldLimits.brand),
  imageUrl: z.union([z.string().url(), z.literal(""), z.null()]).optional(),
});

type ProductMasterFormValues = z.infer<typeof productMasterFormSchema>;

export function ProductMasterDetailPage({
  productMasterId,
}: {
  productMasterId: string;
}) {
  const queryClient = useQueryClient();
  const detailQuery = useQuery({
    queryKey: ["product-master", productMasterId],
    queryFn: () => getProductMaster(productMasterId),
  });

  const updateMutation = useMutation({
    mutationFn: (values: ProductMasterFormValues) =>
      updateProductMaster(productMasterId, {
        ...values,
        imageUrl: values.imageUrl || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["product-master", productMasterId],
      });
      queryClient.invalidateQueries({ queryKey: ["product-masters"] });
    },
  });

  const applyMutation = useMutation({
    mutationFn: (correctionId: string) =>
      applyProductMasterCorrection(productMasterId, correctionId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["product-master", productMasterId],
      });
      queryClient.invalidateQueries({ queryKey: ["product-masters"] });
    },
  });

  const dismissMutation = useMutation({
    mutationFn: (correctionId: string) =>
      dismissProductMasterCorrection(productMasterId, correctionId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["product-master", productMasterId],
      });
      queryClient.invalidateQueries({ queryKey: ["product-masters"] });
    },
  });

  const form = useForm<ProductMasterFormValues>({
    resolver: zodResolver(productMasterFormSchema),
    defaultValues: {
      name: "",
      brand: "",
      category: "",
      imageUrl: "",
    },
  });

  useEffect(() => {
    if (detailQuery.data?.product) {
      form.reset({
        name: detailQuery.data.product.name,
        brand: detailQuery.data.product.brand,
        category: detailQuery.data.product.category,
        imageUrl: detailQuery.data.product.imageUrl ?? "",
      });
    }
  }, [form, detailQuery.data]);

  const onSubmit = form.handleSubmit((values) => {
    updateMutation.mutate({
      ...values,
      imageUrl: values.imageUrl || undefined,
    });
  });

  const product = detailQuery.data?.product;
  const corrections = detailQuery.data?.corrections ?? [];
  const pendingCorrections = corrections.filter(
    (correction) => correction.status === ProductMasterCorrectionStatus.PENDING,
  );
  const scanName = product?.crowdName ?? product?.name;
  const scanBrand = product?.crowdBrand ?? product?.brand;
  const isOfficialSource =
    product?.source === ProductMasterSource.FOODSAFETY_API ||
    product?.source === ProductMasterSource.OPEN_FOOD_FACTS;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Barcode Catalog"
        title={scanName ?? "바코드 상품"}
        description="스캔에 보이는 이름과 원본 목록을 나눠 둬요. 사용자 냉장고 이름은 그대로 둡니다."
      />

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Panel
          title="스캔에 보이는 이름"
          description={
            product
              ? `${product.barcode} · ${productMasterSourceLabels[product.source as ProductMasterSource] ?? product.source}`
              : "불러오는 중"
          }
        >
          <div className="space-y-3 rounded-[var(--radius-2xl)] bg-[var(--surface-muted)] p-5">
            <div>
              <div className="text-sm text-[var(--muted)]">상품명</div>
              <div className="text-xl font-black">{scanName}</div>
            </div>
            <div>
              <div className="text-sm text-[var(--muted)]">브랜드</div>
              <div className="font-semibold">{scanBrand}</div>
            </div>
            <div>
              <div className="text-sm text-[var(--muted)]">카테고리</div>
              <div className="font-semibold">
                {product?.crowdCategory ?? product?.category}
              </div>
            </div>
            {product?.crowdName ? (
              <div className="text-sm text-[var(--muted)]">
                원본 목록은 {product.name} 그대로 남겨 두었어요.
              </div>
            ) : null}
            {typeof product?.confidence === "number" ? (
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill
                  tone={
                    catalogNeedsNameConfirmation(product.confidence)
                      ? "warning"
                      : "success"
                  }
                  label={catalogConfidenceLabel(product.confidence)}
                />
                <div className="text-sm text-[var(--muted)]">
                  {product.confirmCount > 0
                    ? `${product.confirmCount}명이 이 이름이 맞다고 했어요.`
                    : "아직 맞다고 확인해 준 사람이 없어요."}
                </div>
              </div>
            ) : null}
          </div>
        </Panel>

        <Panel
          title="원본 목록 다듬기"
          description={
            isOfficialSource
              ? "공식 출처 원본이에요. 스캔 이름은 제안이 모이면 따로 바뀌어요."
              : "스캔할 때 다른 사용자에게 보여 줄 이름을 고쳐 둘 수 있어요."
          }
        >
          <form className="grid gap-4" onSubmit={onSubmit}>
            <label className="grid gap-2 text-sm font-semibold">
              상품명
              <input
                className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 outline-none"
                {...form.register("name")}
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              브랜드
              <input
                className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 outline-none"
                {...form.register("brand")}
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              카테고리
              <input
                className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 outline-none"
                {...form.register("category")}
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              이미지 URL
              <input
                className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 outline-none"
                {...form.register("imageUrl")}
              />
            </label>
            <button
              type="submit"
              className="rounded-full bg-[var(--primary)] px-4 py-3 text-sm font-bold text-[var(--surface)]"
            >
              이대로 반영할게요
            </button>
          </form>
        </Panel>
      </div>

      <Panel
        title="사용자 수정 제안"
        description={
          pendingCorrections.length > 0
            ? `살펴볼 제안 ${pendingCorrections.length}건. 공식 출처는 원본을 남기고 스캔 이름만 바뀌어요.`
            : "아직 살펴볼 제안이 없어요."
        }
      >
        <div className="space-y-3">
          {corrections.map((correction) => (
            <div
              key={correction.id}
              className="rounded-[var(--radius-2xl)] border border-[var(--border)] bg-[var(--surface-muted)] p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-black">
                    {correction.proposedName}
                  </div>
                  <div className="mt-1 text-sm text-[var(--muted)]">
                    {correction.proposedBrand ?? "브랜드 없음"}
                    {correction.proposedCategory
                      ? ` · ${correction.proposedCategory}`
                      : ""}
                  </div>
                  <div className="mt-2 text-sm text-[var(--muted)]">
                    목록에 있던 이름: {correction.catalogName}
                  </div>
                </div>
                <StatusPill
                  tone={
                    correction.status === ProductMasterCorrectionStatus.PENDING
                      ? "warning"
                      : correction.status ===
                          ProductMasterCorrectionStatus.APPLIED
                        ? "success"
                        : "default"
                  }
                  label={productMasterCorrectionStatusLabels[correction.status]}
                />
              </div>
              {correction.status === ProductMasterCorrectionStatus.PENDING ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={applyMutation.isPending || dismissMutation.isPending}
                    onClick={() => applyMutation.mutate(correction.id)}
                    className="rounded-full bg-[var(--primary)] px-4 py-2 text-sm font-bold text-[var(--surface)] disabled:opacity-40"
                  >
                    이 이름으로 바꿀게요
                  </button>
                  <button
                    type="button"
                    disabled={applyMutation.isPending || dismissMutation.isPending}
                    onClick={() => dismissMutation.mutate(correction.id)}
                    className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-bold disabled:opacity-40"
                  >
                    이 제안은 넘어갈게요
                  </button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
