import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";

export function usePayOverviewQuery() {
  const orgId = useAuthStore((s) => s.orgId);
  return useQuery({
    queryKey: ["pay-overview", orgId],
    queryFn: () => api.payOverview(),
    enabled: !!orgId,
  });
}
