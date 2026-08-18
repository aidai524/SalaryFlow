/**
 * Client-side auth / workspace session store (zustand).
 *
 * Server state (employees, payroll runs, etc.) belongs in @tanstack/react-query.
 * Keep this store for session identity and lightweight UI workspace context.
 *
 * Phase 1: a single org per admin (`user.org_id` + `orgName` / `paymentConfigured`).
 * Future multi-org: introduce memberships + `activeOrgId` and scope query keys to it.
 */

import { create } from "zustand";
import { api, type AuthUser } from "@/lib/api";

interface AuthState {
  user: AuthUser | null;
  orgName: string;
  /** Current workspace org id (phase 1: mirrors user.org_id). */
  orgId: string | null;
  memberCount: number;
  attentionCount: number;
  /** True when team payment preferences are configured (Create Team done). */
  paymentConfigured: boolean;
  bootstrapped: boolean;
  setUser: (user: AuthUser | null) => void;
  setOrgContext: (orgName: string, memberCount: number, paymentConfigured?: boolean) => void;
  setAttentionCount: (count: number) => void;
  applyAuthedUser: (user: AuthUser) => Promise<void>;
  refreshWorkspaceContext: () => Promise<void>;
  bootstrap: () => Promise<void>;
  logout: () => Promise<void>;
}

async function loadWorkspaceContext(user: AuthUser): Promise<{
  orgId: string | null;
  orgName: string;
  memberCount: number;
  attentionCount: number;
  paymentConfigured: boolean;
}> {
  try {
    const context = await api.orgContext();
    return {
      orgId: context.org.id,
      orgName: context.org.name,
      memberCount: context.memberCount,
      attentionCount: user.role === "admin" ? (context.attentionCount ?? 0) : 0,
      paymentConfigured: context.paymentConfigured,
    };
  } catch {
    return {
      orgId: user.org_id,
      orgName: "",
      memberCount: 0,
      attentionCount: 0,
      paymentConfigured: false,
    };
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  orgName: "",
  orgId: null,
  memberCount: 0,
  attentionCount: 0,
  paymentConfigured: false,
  bootstrapped: false,

  setUser: (user) => set({ user }),

  setOrgContext: (orgName, memberCount, paymentConfigured) =>
    set((state) => ({
      orgName,
      memberCount,
      paymentConfigured: paymentConfigured ?? state.paymentConfigured,
    })),

  setAttentionCount: (attentionCount) => set({ attentionCount }),

  applyAuthedUser: async (user) => {
    const context = await loadWorkspaceContext(user);
    set({
      user,
      orgId: context.orgId,
      orgName: context.orgName,
      memberCount: context.memberCount,
      attentionCount: context.attentionCount,
      paymentConfigured: context.paymentConfigured,
    });
  },

  refreshWorkspaceContext: async () => {
    const user = get().user;
    if (!user) return;
    const context = await loadWorkspaceContext(user);
    set({
      orgId: context.orgId,
      orgName: context.orgName,
      memberCount: context.memberCount,
      attentionCount: context.attentionCount,
      paymentConfigured: context.paymentConfigured,
    });
  },

  bootstrap: async () => {
    try {
      const result = await api.me();
      if (result.user) {
        const context = await loadWorkspaceContext(result.user);
        set({
          user: result.user,
          orgId: context.orgId,
          orgName: context.orgName,
          memberCount: context.memberCount,
          attentionCount: context.attentionCount,
          paymentConfigured: context.paymentConfigured,
          bootstrapped: true,
        });
        return;
      }
    } catch {
      // Session missing or expired — treat as logged out.
    }
    set({
      user: null,
      orgId: null,
      orgName: "",
      memberCount: 0,
      attentionCount: 0,
      paymentConfigured: false,
      bootstrapped: true,
    });
  },

  logout: async () => {
    try {
      await api.logout();
    } catch {
      // Ignore logout network errors; clear local session regardless.
    }
    set({
      user: null,
      orgId: null,
      orgName: "",
      memberCount: 0,
      attentionCount: 0,
      paymentConfigured: false,
    });
  },
}));

/** Admin home path after auth — Create Team when payment prefs are missing. */
export function adminHomePath(paymentConfigured: boolean): string {
  return paymentConfigured ? "/pay" : "/teams/create";
}
