// Persistent Quick Pay commit queue. After the wallet returns a deposit tx hash
// we enqueue locally first, then POST /payments/quick-pay/commit with exponential
// backoff — same pattern as StableFlow's trade-report queue.

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { ApiError, api } from "@/lib/api";

const STORAGE_KEY = "salaryflow:quick-pay-commit-queue:v1";
const BASE_RETRY_MS = 5_000;
const MAX_RETRY_MS = 15 * 60 * 1000;
const CONTEXT_TTL_MS = 24 * 60 * 60 * 1000;

/** Permanent failures — drop from queue (do not retry). */
const PERMANENT_ERROR_CODES = new Set([
  "QUICK_PAY_CONTEXT_INVALID",
  "QUICK_PAY_CONTEXT_EXPIRED",
  "QUICK_PAY_SIGNATURE_INVALID",
]);

/** Keep in queue until the original account / wallet is active again. */
const HOLD_ERROR_CODES = new Set([
  "QUICK_PAY_CONTEXT_ORG_MISMATCH",
  "QUICK_PAY_CONTEXT_SIGNER_MISMATCH",
]);

export interface QuickPayCommitItem {
  id: string;
  context: string;
  txHash: string;
  signature?: string;
  createdAt: number;
  employeeName?: string;
  amountLabel?: string;
}

interface QuickPayCommitQueueState {
  queue: QuickPayCommitItem[];
  enqueue: (item: QuickPayCommitItem) => void;
  remove: (id: string) => void;
}

interface TaskMeta {
  inFlight: boolean;
  timer?: ReturnType<typeof setTimeout>;
}

const taskMetaMap = new Map<string, TaskMeta>();

type CommitSuccessListener = () => void;
const successListeners = new Set<CommitSuccessListener>();

export function onQuickPayCommitSuccess(listener: CommitSuccessListener): () => void {
  successListeners.add(listener);
  return () => {
    successListeners.delete(listener);
  };
}

function notifySuccessListeners() {
  for (const listener of successListeners) {
    try {
      listener();
    } catch {
      // ignore listener errors
    }
  }
}

function getRetryDelay(retryCount: number): number {
  return Math.min(MAX_RETRY_MS, BASE_RETRY_MS * 2 ** retryCount);
}

function clearTaskMeta(id: string) {
  const meta = taskMetaMap.get(id);
  if (meta?.timer) clearTimeout(meta.timer);
  taskMetaMap.delete(id);
}

function scheduleRetry(id: string, item: QuickPayCommitItem, retryCount: number) {
  const delay = getRetryDelay(retryCount);
  const meta = taskMetaMap.get(id) ?? { inFlight: false };
  if (meta.timer) clearTimeout(meta.timer);
  meta.timer = setTimeout(() => {
    const current = taskMetaMap.get(id);
    if (current) {
      current.timer = undefined;
      taskMetaMap.set(id, current);
    }
    void processCommit(id, item, retryCount + 1);
  }, delay);
  taskMetaMap.set(id, meta);
}

function toastPermanentFailure(item: QuickPayCommitItem, message: string) {
  // Lazy import avoids coupling the store module to react-toastify at load time
  // in non-UI contexts; failures are rare.
  void import("@/hooks/use-toast").then((mod) => {
    const toast = mod.default();
    toast.fail({
      title: "Payment record sync failed",
      text: item.employeeName
        ? `${item.employeeName}: ${message}`
        : message,
    });
  }).catch(() => {
    // no-op
  });
}

async function processCommit(id: string, item: QuickPayCommitItem, retryCount = 0) {
  const stillQueued = useQuickPayCommitQueueStore.getState().queue.some((row) => row.id === id);
  if (!stillQueued) {
    clearTaskMeta(id);
    return;
  }

  if (Date.now() - item.createdAt > CONTEXT_TTL_MS) {
    useQuickPayCommitQueueStore.getState().remove(id);
    clearTaskMeta(id);
    toastPermanentFailure(item, "Commit context expired after 24 hours");
    return;
  }

  const meta = taskMetaMap.get(id);
  if (meta?.inFlight) return;

  taskMetaMap.set(id, { ...meta, inFlight: true });

  try {
    await api.commitQuickPay({
      context: item.context,
      txHash: item.txHash,
      signature: item.signature,
    });
    useQuickPayCommitQueueStore.getState().remove(id);
    clearTaskMeta(id);
    notifySuccessListeners();
  } catch (error) {
    taskMetaMap.set(id, {
      ...(taskMetaMap.get(id) ?? {}),
      inFlight: false,
    });

    if (error instanceof ApiError) {
      const code = String(error.code || "");
      if (PERMANENT_ERROR_CODES.has(code)) {
        useQuickPayCommitQueueStore.getState().remove(id);
        clearTaskMeta(id);
        toastPermanentFailure(item, error.message);
        return;
      }
      // 401 / org-signer mismatch / other transient API errors: keep queued.
      if (error.status === 401 || HOLD_ERROR_CODES.has(code) || error.status === 403) {
        scheduleRetry(id, item, retryCount);
        return;
      }
    }

    scheduleRetry(id, item, retryCount);
  }
}

export const useQuickPayCommitQueueStore = create(
  persist<QuickPayCommitQueueState>(
    (set) => ({
      queue: [],
      enqueue: (item) => {
        set((state) => {
          if (state.queue.some((row) => row.id === item.id || row.txHash === item.txHash)) {
            return state;
          }
          return { queue: [...state.queue, item] };
        });
      },
      remove: (id) => {
        set((state) => ({
          queue: state.queue.filter((row) => row.id !== id),
        }));
      },
    }),
    {
      name: STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ queue: state.queue }) as QuickPayCommitQueueState,
    },
  ),
);

export function enqueueQuickPayCommit(input: {
  context: string;
  txHash: string;
  signature?: string;
  employeeName?: string;
  amountLabel?: string;
}): string {
  const id = crypto.randomUUID();
  const item: QuickPayCommitItem = {
    id,
    context: input.context,
    txHash: input.txHash,
    signature: input.signature,
    createdAt: Date.now(),
    employeeName: input.employeeName,
    amountLabel: input.amountLabel,
  };
  useQuickPayCommitQueueStore.getState().enqueue(item);
  void processCommit(item.id, item, 0);
  return id;
}

export function processAllPendingQuickPayCommits() {
  const { queue } = useQuickPayCommitQueueStore.getState();
  for (const item of queue) {
    if (Date.now() - item.createdAt > CONTEXT_TTL_MS) {
      useQuickPayCommitQueueStore.getState().remove(item.id);
      clearTaskMeta(item.id);
      toastPermanentFailure(item, "Commit context expired after 24 hours");
      continue;
    }
    const meta = taskMetaMap.get(item.id);
    if (meta?.inFlight || meta?.timer) continue;
    void processCommit(item.id, item, 0);
  }
}
