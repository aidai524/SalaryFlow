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
      void queryClient.invalidateQueries({ queryKey: ["pending-payments"] });
      void queryClient.invalidateQueries({ queryKey: ["pay-overview"] });
      void queryClient.invalidateQueries({ queryKey: ["org-overview"] });
      void queryClient.invalidateQueries({ queryKey: ["org-payments"] });
      void queryClient.invalidateQueries({ queryKey: ["employees"] });
    });
  }, [queryClient]);
}
