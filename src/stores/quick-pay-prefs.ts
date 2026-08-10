// Admin-side Quick Pay preferences (You Pay origin token), persisted locally.

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface QuickPayPrefsState {
  originAssetId: string | null;
  setOriginAssetId: (assetId: string | null) => void;
}

export const useQuickPayPrefsStore = create<QuickPayPrefsState>()(
  persist(
    (set) => ({
      originAssetId: null,
      setOriginAssetId: (originAssetId) => set({ originAssetId }),
    }),
    { name: "decash:quick-pay-prefs:v1" },
  ),
);
