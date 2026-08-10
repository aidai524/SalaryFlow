import { useQuery } from "@tanstack/react-query";
import { api, type ListOrgPaymentsParams, type OrgOverviewParams } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";

export function useOrgOverviewQuery(params: OrgOverviewParams) {
  const orgId = useAuthStore((s) => s.orgId);
  return useQuery({
    queryKey: ["org-overview", orgId, params.periodKey ?? null, params.volumeRange ?? 6],
    queryFn: () => api.orgOverview(params),
    enabled: !!orgId && !!params.periodKey,
  });
}

export function useOrgPaymentsQuery(params: ListOrgPaymentsParams) {
  const orgId = useAuthStore((s) => s.orgId);
  return useQuery({
    queryKey: ["org-payments", orgId, params.periodKey ?? null, params.q ?? ""],
    queryFn: () => api.listOrgPayments(params),
    enabled: !!orgId && !!params.periodKey,
  });
}
