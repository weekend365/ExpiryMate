import { ProductMasterDetailPage } from "../../../src/features/product-masters/product-master-detail-page";

export default async function ProductMasterDetailRoute({
  params,
}: {
  params: Promise<{ id: string; }>;
}) {
  const { id } = await params;

  return <ProductMasterDetailPage productMasterId={id} />;
}
