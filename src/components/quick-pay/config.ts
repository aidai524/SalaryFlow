export const QUICK_PAY_TOAST = {
  SWITCH_BOUND_WALLET: "Switch to your bound payment wallet",
  INSUFFICIENT_BALANCE: "Insufficient balance",
  COULD_NOT_READ_BALANCE: "Could not read wallet balance",
} as const;

export const PRIVATE_BY_DEFAULT_LABEL = "Private by default";

/** Pause after intent sign so wallet UIs (e.g. OKX) can tear down before eth_sendTransaction. */
export const PRIVATE_POST_SIGN_DELAY_MS = 250;
