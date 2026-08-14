// Persistent batch payout commit queue — same durability pattern as Quick Pay.

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { ApiError, api } from "@/lib/api";

const STORAGE_KEY = "salaryflow:batch-payout-commit-queue:v1";
const BASE_RETRY_MS = 5_000;
const MAX_RETRY_MS = 15 * 60 * 1000;
const CONTEXT_TTL_MS = 24 * 60 * 60 * 1000;

const PERMANENT_ERROR_CODES = new Set([
  "QUICK_PAY_CONTEXT_INVALID",
  "QUICK_PAY_CONTEXT_EXPIRED",
  "BATCH_MODE_UNSUPPORTED",
  "BATCH_EMPLOYEE_REQUIRED",
  "BATCH_ORIGIN_MISMATCH",
  "BATCH_CHAIN_NOT_DEPLOYED",
  "BATCH_CONTRACT_MISMATCH",
  "BATCH_DUPLICATE_DEPOSIT",
  "BATCH_DUPLICATE_KEY",
  "IDEMPOTENCY_KEY_CONFLICT",
]);

const HOLD_ERROR_CODES = new Set([
  "QUICK_PAY_CONTEXT_ORG_MISMATCH",
  "QUICK_PAY_CONTEXT_SIGNER_MISMATCH",
]);

export interface BatchPayoutCommitItem {
  id: string;
  batchId: string;
  txHash: string;
  contractAddress: string;
  originToken: "USDC" | "USDT";
  items: Array<{ context: string }>;
  createdAt: number;
}

interface BatchPayoutCommitQueueState {
  queue: BatchPayoutCommitItem[];
  enqueue: (item: BatchPayoutCommitItem) => void;
  remove: (id: string) => void;
}

interface TaskMeta {
  inFlight: boolean;
  timer?: ReturnType<typeof setTimeout>;
}

const taskMetaMap = new Map<string, TaskMeta>();

type CommitSuccessListener = () => void;
const successListeners = new Set<CommitSuccessListener>();

export function onBatchPayoutCommitSuccess(listener: CommitSuccessListener): () => void {
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
      // ignore
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

function scheduleRetry(id: string, item: BatchPayoutCommitItem, retryCount: number) {
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

function toastPermanentFailure(message: string) {
  void import("@/hooks/use-toast").then((mod) => {
    const toast = mod.default();
    toast.fail({ title: "Batch payout record sync failed", text: message });
  }).catch(() => {
    // no-op
  });
}

async function processCommit(id: string, item: BatchPayoutCommitItem, retryCount = 0) {
  const stillQueued = useBatchPayoutCommitQueueStore.getState().queue.some((row) => row.id === id);
  if (!stillQueued) {
    clearTaskMeta(id);
    return;
  }

  if (Date.now() - item.createdAt > CONTEXT_TTL_MS) {
    useBatchPayoutCommitQueueStore.getState().remove(id);
    clearTaskMeta(id);
    toastPermanentFailure("Commit context expired after 24 hours");
    return;
  }

  const meta = taskMetaMap.get(id);
  if (meta?.inFlight) return;
  taskMetaMap.set(id, { ...meta, inFlight: true });

  try {
    await api.commitBatchPayout({
      batchId: item.batchId,
      txHash: item.txHash,
      contractAddress: item.contractAddress,
      originToken: item.originToken,
      items: item.items,
    });
    useBatchPayoutCommitQueueStore.getState().remove(id);
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
        useBatchPayoutCommitQueueStore.getState().remove(id);
        clearTaskMeta(id);
        toastPermanentFailure(error.message);
        return;
      }
      if (error.status === 401 || HOLD_ERROR_CODES.has(code) || error.status === 403) {
        scheduleRetry(id, item, retryCount);
        return;
      }
    }

    scheduleRetry(id, item, retryCount);
  }
}

export const useBatchPayoutCommitQueueStore = create(
  persist<BatchPayoutCommitQueueState>(
    (set) => ({
      queue: [],
      enqueue: (item) => {
        set((state) => {
          if (state.queue.some((row) => row.id === item.id || row.batchId === item.batchId)) {
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
      partialize: (state) => ({ queue: state.queue }) as BatchPayoutCommitQueueState,
    },
  ),
);

export function enqueueBatchPayoutCommit(input: Omit<BatchPayoutCommitItem, "id" | "createdAt">): string {
  const id = crypto.randomUUID();
  const item: BatchPayoutCommitItem = {
    ...input,
    id,
    createdAt: Date.now(),
  };
  useBatchPayoutCommitQueueStore.getState().enqueue(item);
  void processCommit(item.id, item, 0);
  return id;
}

export function processAllPendingBatchPayoutCommits() {
  const { queue } = useBatchPayoutCommitQueueStore.getState();
  for (const item of queue) {
    if (Date.now() - item.createdAt > CONTEXT_TTL_MS) {
      useBatchPayoutCommitQueueStore.getState().remove(item.id);
      clearTaskMeta(item.id);
      toastPermanentFailure("Commit context expired after 24 hours");
      continue;
    }
    const meta = taskMetaMap.get(item.id);
    if (meta?.inFlight || meta?.timer) continue;
    void processCommit(item.id, item, 0);
  }
}
