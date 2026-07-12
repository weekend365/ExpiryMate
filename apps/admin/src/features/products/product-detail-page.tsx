"use client";

import {
  ProductCategory,
  productCategoryLabels,
  productCategoryOptions,
  productUpsertSchema,
} from "@expirymate/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { PageHeader } from "../../components/page-header";
import { Panel } from "../../components/panel";
import { getProduct, updateProduct } from "../../lib/api";

type ProductFormValues = z.infer<typeof productUpsertSchema>;

export function ProductDetailPage({ productId }: { productId: string }) {
  const queryClient = useQueryClient();
  const productQuery = useQuery({
    queryKey: ["product", productId],
    queryFn: () => getProduct(productId),
  });

  const mutation = useMutation({
    mutationFn: (values: Partial<ProductFormValues>) =>
      updateProduct(productId, {
        ...values,
        imageUrl: values.imageUrl || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product", productId] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productUpsertSchema),
    defaultValues: {
      name: "",
      brand: "",
      category: ProductCategory.DAIRY,
      imageUrl: "",
    },
  });

  useEffect(() => {
    if (productQuery.data) {
      form.reset({
        name: productQuery.data.name,
        brand: productQuery.data.brand,
        category: productQuery.data.category,
        imageUrl: productQuery.data.imageUrl ?? "",
      });
    }
  }, [form, productQuery.data]);

  const onSubmit = form.handleSubmit((values) => {
    mutation.mutate({
      ...values,
      imageUrl: values.imageUrl || undefined,
    });
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Product Detail"
        title={productQuery.data?.name ?? "상품 상세"}
        description="상품명, 브랜드, 카테고리, 이미지 URL을 수정할 수 있습니다."
      />

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Panel title="현재 정보" description="모바일 등록과 요리 추천에 사용되는 기준 데이터입니다.">
          <div className="space-y-3 rounded-[var(--radius-2xl)] bg-[var(--surface-muted)] p-5">
            <div>
              <div className="text-sm text-[var(--muted)]">상품명</div>
              <div className="text-xl font-black">{productQuery.data?.name}</div>
            </div>
            <div>
              <div className="text-sm text-[var(--muted)]">브랜드</div>
              <div className="font-semibold">{productQuery.data?.brand}</div>
            </div>
            <div>
              <div className="text-sm text-[var(--muted)]">카테고리</div>
              <div className="font-semibold">
                {productQuery.data ? productCategoryLabels[productQuery.data.category] : "-"}
              </div>
            </div>
          </div>
        </Panel>

        <Panel title="상품 수정" description="운영자가 기준 상품 레코드를 정리하는 화면입니다.">
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
              <select
                className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 outline-none"
                {...form.register("category")}
              >
                {productCategoryOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
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
              수정 저장
            </button>
          </form>
        </Panel>
      </div>
    </div>
  );
}
