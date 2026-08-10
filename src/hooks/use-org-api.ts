import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type TeamPaymentDateKey, type TeamPaymentSchedule } from "@/lib/api";

export function orgContextQueryKey(orgId: string | null | undefined) {
  return ["org-context", orgId ?? "none"] as const;
}

export function useOrgContextQuery(orgId: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: orgContextQueryKey(orgId),
    queryFn: () => api.orgContext(),
    enabled: enabled && Boolean(orgId),
  });
}

export function useUpdateTeamMutation(orgId: string | null | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { paymentSchedule: TeamPaymentSchedule; paymentDate: TeamPaymentDateKey }) =>
      api.updateTeam(body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: orgContextQueryKey(orgId) });
    },
  });
}
