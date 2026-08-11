import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  onQuickPayCommitSuccess,
  processAllPendingQuickPayCommits,
} from "@/stores/quick-pay-commit-queue";

/** Flush persisted Quick Pay commits on admin mount; invalidate docks on success. */
export function useQuickPayCommitQueue() {
  const queryClient = useQueryClient();

  useEffect(() => {
    processAllPendingQuickPayCommits();
    return onQuickPayCommitSuccess(() => {
      // Refetch (not just invalidate) so an empty dock seeds the first row and
      // refetchInterval can start 8s polling immediately after commit lands.
      void queryClient.refetchQueries({ queryKey: ["pending-payments"] });
      void queryClient.invalidateQueries({ queryKey: ["pay-overview"] });
      void queryClient.invalidateQueries({ queryKey: ["org-overview"] });
      void queryClient.invalidateQueries({ queryKey: ["org-payments"] });
      void queryClient.invalidateQueries({ queryKey: ["employees"] });
    });
  }, [queryClient]);
}
