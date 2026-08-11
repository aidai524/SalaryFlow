// Admin-side Quick Pay preferences (You Pay origin token + privacy mode), persisted locally.

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
      paymentMode: "private",
      setOriginAssetId: (originAssetId) => set({ originAssetId }),
      setPaymentMode: (paymentMode) => set({ paymentMode }),
    }),
    { name: "decash:quick-pay-prefs:v1" },
  ),
);
