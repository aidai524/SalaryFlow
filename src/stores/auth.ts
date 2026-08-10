/**
 * Client-side auth / workspace session store (zustand).
 *
 * Server state (employees, payroll runs, etc.) belongs in @tanstack/react-query.
 * Keep this store for session identity and lightweight UI workspace context.
 */

import { create } from "zustand";
import { api, type AuthUser } from "@/lib/api";

interface AuthState {
  user: AuthUser | null;
  orgName: string;
  memberCount: number;
  attentionCount: number;
  bootstrapped: boolean;
  setUser: (user: AuthUser | null) => void;
  setOrgContext: (orgName: string, memberCount: number) => void;
  setAttentionCount: (count: number) => void;
  applyAuthedUser: (user: AuthUser) => Promise<void>;
  bootstrap: () => Promise<void>;
  logout: () => Promise<void>;
}

async function loadWorkspaceContext(user: AuthUser): Promise<{
  orgName: string;
  memberCount: number;
  attentionCount: number;
}> {
  try {
    const context = await api.orgContext();
    const attentionCount = user.role === "admin"
      ? (await api.listEmployees()).employees.filter((employee) => employee.status !== "ready").length
      : 0;
    return {
      orgName: context.org.name,
      memberCount: context.memberCount,
      attentionCount,
    };
  } catch {
    return { orgName: "", memberCount: 0, attentionCount: 0 };
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  orgName: "",
  memberCount: 0,
  attentionCount: 0,
  bootstrapped: false,

  setUser: (user) => set({ user }),

  setOrgContext: (orgName, memberCount) => set({ orgName, memberCount }),

  setAttentionCount: (attentionCount) => set({ attentionCount }),

  applyAuthedUser: async (user) => {
    const context = await loadWorkspaceContext(user);
    set({
      user,
      orgName: context.orgName,
      memberCount: context.memberCount,
      attentionCount: context.attentionCount,
    });
  },

  bootstrap: async () => {
    try {
      const result = await api.me();
      if (result.user) {
        const context = await loadWorkspaceContext(result.user);
        set({
          user: result.user,
          orgName: context.orgName,
          memberCount: context.memberCount,
          attentionCount: context.attentionCount,
          bootstrapped: true,
        });
        return;
      }
    } catch {
      // Session missing or expired — treat as logged out.
    }
    set({
      user: null,
      orgName: "",
      memberCount: 0,
      attentionCount: 0,
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
      orgName: "",
      memberCount: 0,
      attentionCount: 0,
    });
  },
}));
