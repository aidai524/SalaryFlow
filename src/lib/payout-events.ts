export const PAYOUT_UPDATED_EVENT = "salaryflow:payout-updated";

export function notifyPayoutUpdated() {
  window.dispatchEvent(new CustomEvent(PAYOUT_UPDATED_EVENT));
}
