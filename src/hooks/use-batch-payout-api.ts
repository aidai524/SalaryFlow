import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";

export function paymentBatchesQueryKey(
  orgId: string | null | undefined,
  page: number,
  pageSize: number,
) {
  return ["payment-batches", orgId ?? "none", page, pageSize] as const;
}

export function paymentBatchDetailQueryKey(
  orgId: string | null | undefined,
  batchId: string | null | undefined,
) {
  return ["payment-batch", orgId ?? "none", batchId ?? "none"] as const;
}

export function usePaymentBatchesQuery(page: number, pageSize: number) {
  const orgId = useAuthStore((s) => s.orgId);
  return useQuery({
    queryKey: paymentBatchesQueryKey(orgId, page, pageSize),
    queryFn: () => api.listPaymentBatches({ page, pageSize }),
    enabled: !!orgId,
    placeholderData: (prev) => prev,
    refetchInterval: 8_000,
  });
}

export function usePaymentBatchDetailQuery(batchId: string | null, enabled: boolean) {
  const orgId = useAuthStore((s) => s.orgId);
  return useQuery({
    queryKey: paymentBatchDetailQueryKey(orgId, batchId),
    queryFn: () => api.getPaymentBatch(batchId!),
    enabled: !!orgId && !!batchId && enabled,
    refetchInterval: enabled ? 8_000 : false,
  });
}
