import { useQuery } from "@tanstack/react-query";
import { useAuthedServerFn } from "@/lib/authed-server-fn";
import { getCurrentMember } from "@/lib/pricing.functions";

export function useManagerCheck() {
  const meFn = useAuthedServerFn(getCurrentMember);

  const me = useQuery({
    queryKey: ["me"],
    queryFn: () => meFn(),
    staleTime: 60_000,
  });

  return {
    isManager: me.data?.is_manager ?? false,
    isLoading: me.isLoading,
    tier: me.data?.tier ?? null,
    canSeeInventory: me.data?.can_see_inventory ?? false,
  };
}
