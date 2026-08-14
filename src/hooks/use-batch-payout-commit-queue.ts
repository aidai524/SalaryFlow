import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  onBatchPayoutCommitSuccess,
  processAllPendingBatchPayoutCommits,
} from "@/stores/batch-payout-commit-queue";

/** Flush persisted batch commits on admin mount. */
export function useBatchPayoutCommitQueue() {
  const queryClient = useQueryClient();

  useEffect(() => {
    processAllPendingBatchPayoutCommits();
    return onBatchPayoutCommitSuccess(() => {
      void queryClient.refetchQueries({ queryKey: ["pending-payments"] });
      void queryClient.invalidateQueries({ queryKey: ["pay-overview"] });
      void queryClient.invalidateQueries({ queryKey: ["org-overview"] });
      void queryClient.invalidateQueries({ queryKey: ["org-payments"] });
      void queryClient.invalidateQueries({ queryKey: ["payment-batches"] });
      void queryClient.invalidateQueries({ queryKey: ["employees"] });
    });
  }, [queryClient]);
}
