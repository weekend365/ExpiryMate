import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import {
  ApiError,
  createIdempotencyKey,
  createInventoryItem,
} from "../../services/api";
import { useActiveSpace } from "../spaces/space-provider";
import { useAuth } from "../auth/use-auth";
import {
  sessionQueryKeys,
  withInventorySpace,
} from "../auth/session-boundary";

export const useSaveInventoryItem = () => {
  const queryClient = useQueryClient();
  const { activeSpaceId } = useActiveSpace();
  const { sessionUserId } = useAuth();
  const submissionRef = useRef<{
    idempotencyKey: string;
    payload: Parameters<typeof createInventoryItem>[0];
  } | null>(null);

  return useMutation({
    mutationFn: (payload: Parameters<typeof createInventoryItem>[0]) => {
      if (!activeSpaceId) {
        throw new Error("함께 쓸 냉장고를 먼저 골라 주세요.");
      }
      submissionRef.current ??= {
        idempotencyKey: createIdempotencyKey(),
        payload,
      };
      return createInventoryItem(
        submissionRef.current.payload,
        activeSpaceId,
        submissionRef.current.idempotencyKey,
      );
    },
    onSuccess: () => {
      submissionRef.current = null;
      queryClient.invalidateQueries({
        queryKey: withInventorySpace(
          sessionQueryKeys.dashboard,
          sessionUserId,
          activeSpaceId,
        ),
      });
      queryClient.invalidateQueries({
        queryKey: withInventorySpace(
          sessionQueryKeys.inventory,
          sessionUserId,
          activeSpaceId,
        ),
      });
    },
    onError: (error) => {
      if (
        error instanceof ApiError &&
        error.status < 500 &&
        error.status !== 408
      ) {
        submissionRef.current = null;
      }
    },
  });
};
