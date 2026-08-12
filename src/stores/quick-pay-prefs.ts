// Admin-side Quick Pay preferences (You Pay origin token + payment mode), persisted locally.

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
        // Force standard: migrate any previously persisted private preference.
        if (state?.paymentMode === "private") {
          state.setPaymentMode("standard");
        }
      },
    },
  ),
);
