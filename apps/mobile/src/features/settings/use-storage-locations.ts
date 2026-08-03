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

export const useStorageLocations = () => {
  const queryClient = useQueryClient();
  const {
    sessionUserId,
    activeSpaceId,
    enabled,
    isAwaitingSpace,
    blockingSpaceError,
    refetchSpaces,
  } = useSpaceScopedQueryGate();
  const queryKey = withInventorySpace(
    sessionQueryKeys.storageLocations,
    sessionUserId,
    activeSpaceId,
  );

  const query = useQuery({
    queryKey,
    queryFn: () => listStorageLocations(activeSpaceId),
    enabled,
  });

  const selectableOptions = useMemo(() => {
    const system =
      query.data?.system.map((location) => ({
        key: location.key,
        label: location.label,
        readonly: true as const,
      })) ?? [];
    const custom =
      query.data?.custom.map((location) => ({
        key: location.key,
        label: location.label,
        id: location.id,
        readonly: false as const,
      })) ?? [];

    return [...system, ...custom];
  }, [query.data]);

  const resolveLabel = (key: string) =>
    resolveStorageLocationLabel(key, query.data?.custom ?? []);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey });
  };

  const createMutation = useMutation({
    mutationFn: (payload: { label: string }) =>
      createStorageLocation(payload, activeSpaceId),
    onSuccess: invalidate,
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      label,
    }: {
      id: string;
      label: string;
    }) => updateStorageLocation(id, { label }, activeSpaceId),
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteStorageLocation(id, activeSpaceId),
    onSuccess: invalidate,
  });

  return {
    query: {
      ...query,
      error: blockingSpaceError ?? query.error,
      isError: Boolean(blockingSpaceError) || query.isError,
      // Prefer isPending: enabled queries can be pending+idle briefly before fetch.
      isLoading:
        !blockingSpaceError && (isAwaitingSpace || query.isPending),
      isPending:
        !blockingSpaceError && (isAwaitingSpace || query.isPending),
      refetch: blockingSpaceError ? refetchSpaces : query.refetch,
    },
    selectableOptions,
    resolveLabel,
    createMutation,
    updateMutation,
    deleteMutation,
  };
};
