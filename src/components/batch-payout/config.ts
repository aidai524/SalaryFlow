import { BATCH_PAYOUT_MAX_ITEMS } from "@/config/batch-payout-chains";

export const BATCH_PAYOUT_PAGE_SIZE = 10;
export const BATCH_QUOTE_CONCURRENCY = 3;
export const BATCH_PAYOUT_DIALOG_MAX_WIDTH_PX = 880;
export const BATCH_PAYOUT_DIALOG_DESKTOP_CLASSNAME =
  "max-h-[90vh] max-w-[880px] gap-0 overflow-hidden rounded-[24px] border-none bg-transparent p-0 shadow-none ring-0 sm:max-w-[880px]";
export const SEARCH_DEBOUNCE_MS = 300;
export { BATCH_PAYOUT_MAX_ITEMS };

export const BATCH_PAYOUT_TOAST = {
  MAX_ITEMS: `You can pay up to ${BATCH_PAYOUT_MAX_ITEMS} recipients at once`,
  SWITCH_WALLET: "Switch to your bound payment wallet",
  NO_CONTRACT: "Batch payout is not deployed on this chain yet",
  INSUFFICIENT_BALANCE: "Insufficient balance",
  SUBMITTED: "Payment submitted",
} as const;
