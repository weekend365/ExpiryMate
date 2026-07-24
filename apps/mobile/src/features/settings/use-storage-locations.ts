import { resolveStorageLocationLabel } from "@expirymate/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  createStorageLocation,
  deleteStorageLocation,
  listStorageLocations,
  updateStorageLocation,
} from "../../services/api";
import { useAuth } from "../auth/use-auth";
import {
  sessionQueryKeys,
  withInventorySpace,
} from "../auth/session-boundary";
import { useActiveSpace } from "../spaces/space-provider";

export const useStorageLocations = () => {
  const queryClient = useQueryClient();
  const { sessionUserId } = useAuth();
  const { activeSpaceId, isReady } = useActiveSpace();
  const queryKey = withInventorySpace(
    sessionQueryKeys.storageLocations,
    sessionUserId,
    activeSpaceId,
  );

  const query = useQuery({
    queryKey,
    queryFn: () => listStorageLocations(activeSpaceId),
    enabled: Boolean(sessionUserId && activeSpaceId && isReady),
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
    query,
    selectableOptions,
    resolveLabel,
    createMutation,
    updateMutation,
    deleteMutation,
  };
};
