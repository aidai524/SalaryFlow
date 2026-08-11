import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PAYOUT_UPDATED_EVENT } from "@/lib/payout-events";
import { useAuthStore } from "@/stores/auth";

export function myPayoutQueryKey(orgId: string | null | undefined) {
  return ["my-payout", orgId ?? "none"] as const;
}

export function myPaymentsQueryKey(orgId: string | null | undefined) {
  return ["my-payments", orgId ?? "none"] as const;
}

export function useMyPayoutQuery() {
  const orgId = useAuthStore((s) => s.orgId);
  const queryClient = useQueryClient();

  useEffect(() => {
    const onUpdated = () => {
      void queryClient.invalidateQueries({ queryKey: myPayoutQueryKey(orgId) });
    };
    window.addEventListener(PAYOUT_UPDATED_EVENT, onUpdated);
    return () => window.removeEventListener(PAYOUT_UPDATED_EVENT, onUpdated);
  }, [orgId, queryClient]);

  return useQuery({
    queryKey: myPayoutQueryKey(orgId),
    queryFn: () => api.myPayout(),
    enabled: !!orgId,
  });
}

export function useMyPaymentsQuery() {
  const orgId = useAuthStore((s) => s.orgId);
  return useQuery({
    queryKey: myPaymentsQueryKey(orgId),
    queryFn: () => api.myRecords({ limit: 50 }),
    enabled: !!orgId,
  });
}

export function useUpdateMyProfileMutation() {
  const orgId = useAuthStore((s) => s.orgId);
  const queryClient = useQueryClient();
  const setUser = useAuthStore((s) => s.setUser);
  const user = useAuthStore((s) => s.user);

  return useMutation({
    mutationFn: (body: {
      name?: string;
      email?: string | null;
      token?: string;
      network?: string;
      endpoint?: string;
      avatar_url?: string | null;
    }) => api.updateMyProfile(body),
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: myPayoutQueryKey(orgId) }),
        queryClient.invalidateQueries({ queryKey: myPaymentsQueryKey(orgId) }),
      ]);
      if (user && result.payout) {
        setUser({
          ...user,
          name: result.payout.name || user.name,
          email: result.payout.email || user.email,
          wallet_address: result.payoutChanged
            ? user.wallet_address
            : (result.payout.endpoint || user.wallet_address),
          wallet_verified: result.payoutChanged ? false : user.wallet_verified,
        });
      }
    },
  });
}
