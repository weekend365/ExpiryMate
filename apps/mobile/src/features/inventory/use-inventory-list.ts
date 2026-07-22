import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../auth/use-auth";
import { sessionQueryKeys, withSessionUser } from "../auth/session-boundary";
import { listAllInventory } from "../../services/api";

export const useInventoryList = () => {
  const { sessionUserId } = useAuth();

  return useQuery({
    queryKey: withSessionUser(sessionQueryKeys.inventory, sessionUserId),
    queryFn: listAllInventory,
    enabled: Boolean(sessionUserId),
  });
};
