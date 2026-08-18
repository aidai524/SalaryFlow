import { useEffect } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { chainKindForNetwork } from "@/config/chains";
import { api, type MyPayout } from "@/lib/api";
import { PAYOUT_UPDATED_EVENT } from "@/lib/payout-events";
import { useAuthStore } from "@/stores/auth";
import { HISTORY_PAGE_SIZE } from "@/views/employee/my-pay/config";
import type { ChainKind } from "@/wallet";

export function myPayoutQueryKey(orgId: string | null | undefined) {
  return ["my-payout", orgId ?? "none"] as const;
}

export function myPaymentsQueryKey(orgId: string | null | undefined, page?: number) {
  return page == null
    ? (["my-payments", orgId ?? "none"] as const)
    : (["my-payments", orgId ?? "none", page] as const);
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

  const role = useAuthStore((s) => s.user?.role);
  return useQuery({
    queryKey: myPayoutQueryKey(orgId),
    queryFn: () => api.myPayout(),
    enabled: !!orgId && role === "employee",
  });
}

export function useMyPaymentsQuery(page = 1) {
  const orgId = useAuthStore((s) => s.orgId);
  return useQuery({
    queryKey: myPaymentsQueryKey(orgId, page),
    queryFn: () => api.myRecords({ page, pageSize: HISTORY_PAGE_SIZE }),
    enabled: !!orgId,
    placeholderData: keepPreviousData,
  });
}

function payoutChainKind(network: string | null | undefined): ChainKind {
  const kind = chainKindForNetwork(network || "");
  return kind === "near" || kind === "solana" ? kind : "evm";
}

export function useUpdateMyProfileMutation() {
  const orgId = useAuthStore((s) => s.orgId);
  const queryClient = useQueryClient();
  const setUser = useAuthStore((s) => s.setUser);

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
      if (result.payout) {
        queryClient.setQueryData<{ payout: MyPayout | null }>(myPayoutQueryKey(orgId), { payout: result.payout });
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: myPayoutQueryKey(orgId) }),
        queryClient.invalidateQueries({ queryKey: myPaymentsQueryKey(orgId) }),
      ]);
      const current = useAuthStore.getState().user;
      if (current && result.payout) {
        setUser({
          ...current,
          name: result.payout.name || current.name,
          email: result.payout.email || current.email,
          wallet_address: result.payout.endpoint || current.wallet_address,
          wallet_chain_kind: payoutChainKind(result.payout.network),
          wallet_verified: result.payoutChanged ? false : current.wallet_verified,
        });
      }
    },
  });
}
