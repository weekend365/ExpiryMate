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
import { sessionQueryKeys, withSessionUser } from "../auth/session-boundary";

export const useStorageLocations = () => {
  const queryClient = useQueryClient();
  const { sessionUserId } = useAuth();
  const queryKey = withSessionUser(
    sessionQueryKeys.storageLocations,
    sessionUserId,
  );

  const query = useQuery({
    queryKey,
    queryFn: listStorageLocations,
    enabled: Boolean(sessionUserId),
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
    mutationFn: createStorageLocation,
    onSuccess: invalidate,
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      label,
    }: {
      id: string;
      label: string;
    }) => updateStorageLocation(id, { label }),
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteStorageLocation,
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
