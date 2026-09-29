import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useFocusEffect } from "expo-router";
import { useCallback } from "react";
import type {
  CreateShoppingItem,
  UpdateShoppingItem,
} from "@expirymate/shared";
import {
  createShoppingItem,
  deleteShoppingItem,
  getShoppingList,
  updateShoppingItem,
} from "../../services/api";
import { sessionQueryKeys, withInventorySpace } from "../auth/session-boundary";
import { useSpaceScopedQueryGate } from "../spaces/use-space-scoped-query-gate";
import { useSpaceScopedQueryResult } from "../spaces/use-space-scoped-query-result";

type Change =
  | { action: "create"; body: CreateShoppingItem }
  | { action: "update"; id: string; body: UpdateShoppingItem }
  | { action: "delete"; id: string; expectedVersion: number };

export function useShoppingList() {
  const gate = useSpaceScopedQueryGate();
  const client = useQueryClient();
  const key = withInventorySpace(
    sessionQueryKeys.shoppingList,
    gate.sessionUserId,
    gate.activeSpaceId,
  );
  const query = useQuery({
    queryKey: key,
    enabled: gate.enabled,
    queryFn: () => {
      if (!gate.activeSpaceId) throw new Error("냉장고를 먼저 골라 주세요.");
      return getShoppingList(gate.activeSpaceId);
    },
  });
  const { refetch } = query;
  useFocusEffect(
    useCallback(() => {
      if (gate.enabled) void refetch();
    }, [gate.enabled, refetch]),
  );
  const mutation = useMutation({
    mutationFn: async (input: {
      change: Change;
      spaceId: string;
      userId: string;
    }) => {
      const { change, spaceId } = input;
      if (change.action === "create")
        return createShoppingItem(spaceId, change.body);
      if (change.action === "update")
        return updateShoppingItem(spaceId, change.id, change.body);
      return deleteShoppingItem(spaceId, change.id, change.expectedVersion);
    },
    onSettled: (_data, _error, input) =>
      client.invalidateQueries({
        queryKey: withInventorySpace(
          sessionQueryKeys.shoppingList,
          input.userId,
          input.spaceId,
        ),
      }),
  });
  const change = (input: Change) => {
    if (!gate.activeSpaceId || !gate.sessionUserId || !gate.enabled)
      return Promise.reject(new Error("냉장고를 먼저 골라 주세요."));
    return mutation.mutateAsync({
      change: input,
      spaceId: gate.activeSpaceId,
      userId: gate.sessionUserId,
    });
  };
  return {
    query: useSpaceScopedQueryResult(query, gate),
    change,
    isPending: mutation.isPending,
    ready: gate.enabled,
  };
}
