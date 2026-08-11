/**
 * Global admin drawer host state (zustand).
 * Any page can open drawers without nesting providers.
 */

import { create } from "zustand";

export type DrawerKind = "recipient-picker" | null;

export interface RecipientPickerPayload {
  selectedId?: string | null;
  filter?: "all" | "employee" | "contractor" | "others";
  onSelect?: (employeeId: string) => void;
}

interface DrawerState {
  kind: DrawerKind;
  recipientPicker: RecipientPickerPayload | null;
  openRecipientPicker: (payload?: RecipientPickerPayload) => void;
  close: () => void;
}

export const useDrawerStore = create<DrawerState>((set) => ({
  kind: null,
  recipientPicker: null,
  openRecipientPicker: (payload = {}) =>
    set({ kind: "recipient-picker", recipientPicker: payload }),
  close: () => set({ kind: null, recipientPicker: null }),
}));
