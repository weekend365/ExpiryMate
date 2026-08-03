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
    queryFn: () => listStorageLocations(gate.activeSpaceId),
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

  const createMutation = useMutation({
    mutationFn: (payload: { label: string }) =>
      createStorageLocation(payload, gate.activeSpaceId),
    onSuccess: invalidate,
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      label,
    }: {
      id: string;
      label: string;
    }) => updateStorageLocation(id, { label }, gate.activeSpaceId),
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      deleteStorageLocation(id, gate.activeSpaceId),
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
