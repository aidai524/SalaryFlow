import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type PendingPaymentRow } from "@/lib/api";

const PENDING_QUERY_KEY = ["pending-payments"] as const;
const ACTIVE_POLL_MS = 8_000;

/** States the reconcile API will accept (wallet signature not involved yet → skip). */
const RECONCILABLE_STATES = new Set<PendingPaymentRow["state"]>([
  "submitting",
  "submitted",
  "awaiting_deposit",
  "deposit_submitted",
  "funding_quoted",
  "funding_deposit_submitted",
  "funding_processing",
  "processing",
]);

function statusLabel(state: PendingPaymentRow["state"]): string {
  switch (state) {
    case "awaiting_deposit":
    case "funding_quoted":
      return "Awaiting deposit";
    case "deposit_submitted":
      return "Confirming deposit";
    case "funding_deposit_submitted":
    case "funding_processing":
      return "Securing funds privately";
    case "awaiting_signature":
    case "generating":
    case "quoted":
    case "quoting":
      return "Preparing payment";
    case "submitting":
    case "submitted":
      return "Sending to recipient";
    case "processing":
      return "Processing";
    case "failed":
      return "Failed";
    case "refunded":
      return "Refunded";
    default:
      return "Processing";
  }
}

export function pendingStatusLabel(state: PendingPaymentRow["state"]): string {
  return statusLabel(state);
}

export function usePendingPaymentsQuery() {
  const queryClient = useQueryClient();
  const previousIdsRef = useRef<Set<string>>(new Set());

  const query = useQuery({
    queryKey: PENDING_QUERY_KEY,
    queryFn: async () => {
      const first = await api.listPendingPayments();
      if (first.payments.length === 0) return first.payments;

      // Advance in-flight attempts inside the same poll tick.
      // Prefer per-attempt force reconcile so a cron claim/backoff cannot stall
      // the dock; fall back to batch reconcile if the single-attempt call fails.
      // Do not invalidate pending after reconcile — that caused an infinite loop.
      const reconcilable = first.payments
        .filter((payment) => RECONCILABLE_STATES.has(payment.state))
        .slice(0, 5);
      try {
        if (reconcilable.length > 0) {
          await Promise.all(
            reconcilable.map((payment) =>
              api.reconcilePaymentAttempt(payment.attemptId).catch(() => null),
            ),
          );
        } else {
          await api.reconcileOpenPayments();
        }
      } catch {
        try {
          await api.reconcileOpenPayments();
        } catch {
          return first.payments;
        }
      }
      const refreshed = await api.listPendingPayments();
      return refreshed.payments;
    },
    // Poll only while the dock has rows; stop when empty to avoid idle traffic.
    // Empty → first item is seeded by commit-success refetch (not this interval).
    refetchInterval: (q) => ((q.state.data?.length ?? 0) > 0 ? ACTIVE_POLL_MS : false),
    staleTime: ACTIVE_POLL_MS,
    refetchOnWindowFocus: true,
  });

  const payments = query.data ?? [];

  // When items leave the pending list, refresh overview / history.
  useEffect(() => {
    const nextIds = new Set(payments.map((item) => item.attemptId));
    const previous = previousIdsRef.current;
    let removed = false;
    for (const id of previous) {
      if (!nextIds.has(id)) {
        removed = true;
        break;
      }
    }
    previousIdsRef.current = nextIds;
    if (!removed || previous.size === 0) return;
    void queryClient.invalidateQueries({ queryKey: ["pay-overview"] });
    void queryClient.invalidateQueries({ queryKey: ["org-overview"] });
    void queryClient.invalidateQueries({ queryKey: ["org-payments"] });
    void queryClient.invalidateQueries({ queryKey: ["employees"] });
  }, [payments, queryClient]);

  return query;
}
