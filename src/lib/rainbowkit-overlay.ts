/** RainbowKit portals use [data-rk]; Radix Dialog sets body pointer-events: none. */

export function isRainbowKitEventTarget(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest("[data-rk]"));
}

export function preventRainbowKitDialogDismiss(event: {
  preventDefault: () => void;
  target: EventTarget | null;
}): void {
  if (isRainbowKitEventTarget(event.target)) {
    event.preventDefault();
  }
}
