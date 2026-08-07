import { resolveStorageLocationLabel } from "@expirymate/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  createStorageLocation,
  deleteStorageLocation,
  listStorageLocations,
  updateStorageLocation,
} from "../../services/api";
import {
  sessionQueryKeys,
  withInventorySpace,
} from "../auth/session-boundary";
import { useSpaceScopedQueryGate } from "../spaces/use-space-scoped-query-gate";
import { useSpaceScopedQueryResult } from "../spaces/use-space-scoped-query-result";

export const useStorageLocations = () => {
  const queryClient = useQueryClient();
  const gate = useSpaceScopedQueryGate();
  const queryKey = withInventorySpace(
    sessionQueryKeys.storageLocations,
    gate.sessionUserId,
    gate.activeSpaceId,
  );

  const query = useQuery({
    queryKey,
    queryFn: () => {
      if (!gate.activeSpaceId) {
        throw new Error("함께 쓸 냉장고를 먼저 골라 주세요.");
      }
      return listStorageLocations(gate.activeSpaceId);
    },
    enabled: gate.enabled,
    refetchOnMount: "always",
  });

  const scopedQuery = useSpaceScopedQueryResult(query, gate);

  const selectableOptions = useMemo(() => {
    const system =
      scopedQuery.data?.system.map((location) => ({
        key: location.key,
        label: location.label,
        readonly: true as const,
      })) ?? [];
    const custom =
      scopedQuery.data?.custom.map((location) => ({
        key: location.key,
        label: location.label,
        id: location.id,
        readonly: false as const,
      })) ?? [];

    return [...system, ...custom];
  }, [scopedQuery.data]);

  const resolveLabel = (key: string) =>
    resolveStorageLocationLabel(key, scopedQuery.data?.custom ?? []);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey });
  };

  const requireSpaceId = () => {
    if (!gate.activeSpaceId) {
      throw new Error("함께 쓸 냉장고를 먼저 골라 주세요.");
    }
    return gate.activeSpaceId;
  };

  const createMutation = useMutation({
    mutationFn: (payload: { label: string }) =>
      createStorageLocation(payload, requireSpaceId()),
    onSuccess: invalidate,
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      label,
    }: {
      id: string;
      label: string;
    }) => updateStorageLocation(id, { label }, requireSpaceId()),
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteStorageLocation(id, requireSpaceId()),
    onSuccess: invalidate,
  });

  return {
    query: scopedQuery,
    selectableOptions,
    resolveLabel,
    createMutation,
    updateMutation,
    deleteMutation,
  };
};
