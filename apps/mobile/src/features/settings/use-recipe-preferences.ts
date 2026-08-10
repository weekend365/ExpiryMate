import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getRecipePreferences,
  updateRecipePreferences,
} from "../../services/api";
import { useAuth } from "../auth/use-auth";
import { sessionQueryKeys, withSessionUser } from "../auth/session-boundary";

export function useRecipePreferences() {
  const queryClient = useQueryClient();
  const { sessionUserId } = useAuth();
  const queryKey = withSessionUser(
    sessionQueryKeys.recipePreferences,
    sessionUserId,
  );

  const query = useQuery({
    queryKey,
    queryFn: getRecipePreferences,
    enabled: Boolean(sessionUserId),
  });
  const mutation = useMutation({
    mutationFn: updateRecipePreferences,
    onSuccess: (data) => queryClient.setQueryData(queryKey, data),
  });

  return { query, mutation };
}
