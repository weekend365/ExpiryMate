import { useQuery } from "@tanstack/react-query";
import { listInventory } from "../../services/api";

export const useInventoryList = () =>
  useQuery({
    queryKey: ["inventory-list"],
    queryFn: listInventory,
  });
