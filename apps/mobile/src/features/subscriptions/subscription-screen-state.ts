import type { SubscriptionEntitlement } from "@expirymate/shared";

type QuerySnapshot<T> = {
  data: T | undefined;
  isError: boolean;
  isFetching: boolean;
};

export type SubscriptionScreenState = {
  status: "loading" | "error" | "active" | "free";
  statusIsStale: boolean;
  sales: "hidden" | "loading" | "error" | "available" | "paused";
};

export function getSubscriptionScreenState({
  entitlement,
  sales,
}: {
  entitlement: QuerySnapshot<Pick<SubscriptionEntitlement, "hasActiveEntitlement">>;
  sales: QuerySnapshot<boolean>;
}): SubscriptionScreenState {
  if (!entitlement.data) {
    return {
      status: entitlement.isError && !entitlement.isFetching ? "error" : "loading",
      statusIsStale: false,
      sales: "hidden",
    };
  }

  const status = entitlement.data.hasActiveEntitlement ? "active" : "free";
  // A stale entitlement is useful to display, but cannot establish purchase eligibility.
  if (status === "active" || entitlement.isError) {
    return { status, statusIsStale: entitlement.isError, sales: "hidden" };
  }

  return {
    status,
    statusIsStale: false,
    sales: sales.isError
      ? sales.isFetching ? "loading" : "error"
      : sales.data === undefined
        ? "loading"
        : sales.data ? "available" : "paused",
  };
}
