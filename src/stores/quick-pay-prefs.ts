// Admin-side Quick Pay preferences (You Pay origin token + payment mode), persisted locally.
//
// KEEP `paymentMode` / `setPaymentMode`: they back the hidden Private | Standard toggle
// (removed in e8a2b2d4e1acbe74424db708a13e1eea5a3c5b99). Do not drop this field.
// Rehydrate still migrates a persisted `"private"` value to `"standard"` while the UI is hidden.

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { QuickPayMode } from "@/lib/api";

interface QuickPayPrefsState {
  originAssetId: string | null;
  paymentMode: QuickPayMode;
  setOriginAssetId: (assetId: string | null) => void;
  setPaymentMode: (mode: QuickPayMode) => void;
}

export const useQuickPayPrefsStore = create<QuickPayPrefsState>()(
  persist(
    (set) => ({
      originAssetId: null,
      paymentMode: "standard",
      setOriginAssetId: (originAssetId) => set({ originAssetId }),
      setPaymentMode: (paymentMode) => set({ paymentMode }),
    }),
    {
      name: "decash:quick-pay-prefs:v1",
      onRehydrateStorage: () => (state) => {
        // While private UI is hidden, migrate any previously persisted private preference.
        if (state?.paymentMode === "private") {
          state.setPaymentMode("standard");
        }
      },
    },
  ),
);
