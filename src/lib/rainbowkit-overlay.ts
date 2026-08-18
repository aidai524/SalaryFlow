/** Wallet connect portals sit above Radix Dialog, which sets body pointer-events: none. */

const WALLET_OVERLAY_SELECTORS = [
  "[data-rk]",
  ".wallet-adapter-modal",
  "#near-wallet-selector-modal",
  ".nws-modal",
  ".nws-modal-wrapper",
].join(", ");

export function isWalletOverlayEventTarget(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest(WALLET_OVERLAY_SELECTORS));
}

/** @deprecated Use isWalletOverlayEventTarget */
export function isRainbowKitEventTarget(target: EventTarget | null): boolean {
  return isWalletOverlayEventTarget(target);
}

export function preventWalletOverlayDialogDismiss(event: {
  preventDefault: () => void;
  target: EventTarget | null;
}): void {
  if (isWalletOverlayEventTarget(event.target)) {
    event.preventDefault();
  }
}

/** @deprecated Use preventWalletOverlayDialogDismiss */
export function preventRainbowKitDialogDismiss(event: {
  preventDefault: () => void;
  target: EventTarget | null;
}): void {
  preventWalletOverlayDialogDismiss(event);
}
