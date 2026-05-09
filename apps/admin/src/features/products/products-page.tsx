"use client";

import {
  ProductCategory,
  productCategoryLabels,
  productCategoryOptions,
  productUpsertSchema,
} from "@expirymate/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { PageHeader } from "../../components/page-header";
import { Panel } from "../../components/panel";
import { createProduct, listProducts } from "../../lib/api";

type ProductFormValues = z.infer<typeof productUpsertSchema>;

export function ProductsPage() {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const productsQuery = useQuery({
    queryKey: ["products", query],
    queryFn: () => listProducts(query),
  });

  const createMutation = useMutation({
    mutationFn: createProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      form.reset({
        name: "",
        brand: "",
        category: ProductCategory.DAIRY,
        imageUrl: "",
      });
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

  const onSubmit = form.handleSubmit((values) => {
    createMutation.mutate({
      ...values,
      imageUrl: values.imageUrl || undefined,
    });
  });

  const products = useMemo(() => productsQuery.data ?? [], [productsQuery.data]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Products"
        title="상품 관리"
        description="요리 추천과 재료 등록에 사용할 기준 상품 데이터를 생성하거나 수정합니다."
      />

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Panel title="새 상품 등록" description="반복해서 쓰는 재료와 생활용품 기준 데이터를 등록합니다.">
          <form className="grid gap-4" onSubmit={onSubmit}>
            <label className="grid gap-2 text-sm font-semibold">
              상품명
              <input
                className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 outline-none"
                {...form.register("name")}
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              브랜드
              <input
                className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 outline-none"
                {...form.register("brand")}
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              카테고리
              <select
                className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 outline-none"
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
                className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 outline-none"
                {...form.register("imageUrl")}
              />
            </label>
            <button
              type="submit"
              className="rounded-full bg-[var(--primary)] px-4 py-3 text-sm font-bold text-white"
            >
              등록하기
            </button>
          </form>
        </Panel>

        <Panel
          title="상품 목록"
          description="상품명과 브랜드로 검색할 수 있습니다."
          action={
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="상품명 또는 브랜드 검색"
              className="w-full min-w-64 rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-2 text-sm outline-none"
            />
          }
        >
          <div className="space-y-3">
            {products.map((product) => (
              <Link
                key={product.id}
                href={`/products/${product.id}`}
                className="block rounded-3xl border border-[var(--border)] bg-[var(--surface-muted)] p-4 transition hover:-translate-y-0.5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-lg font-black">{product.name}</div>
                    <div className="mt-1 text-sm text-[var(--muted)]">
                      {product.brand} · {productCategoryLabels[product.category]}
                    </div>
                  </div>
                  <div className="rounded-full bg-[var(--primary-soft)] px-3 py-1 text-xs font-bold text-[var(--primary)]">
                    {productCategoryLabels[product.category]}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
