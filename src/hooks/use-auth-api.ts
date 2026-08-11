import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useLoginMutation() {
  return useMutation({
    mutationFn: (body: { email: string; password: string }) => api.login(body),
  });
}

export function useRegistrationConfigQuery() {
  return useQuery({
    queryKey: ["auth", "registration"],
    queryFn: () => api.registrationConfig(),
    staleTime: 60_000,
  });
}

export function useRegisterMutation() {
  return useMutation({
    mutationFn: (body: {
      email: string;
      password: string;
      name: string;
      orgName: string;
      inviteCode?: string;
    }) => api.register(body),
  });
}

export function useAcceptInviteMutation() {
  return useMutation({
    mutationFn: (body: { token: string }) => api.acceptInvite(body),
  });
}

export function useChangePasswordMutation() {
  return useMutation({
    mutationFn: (body: { currentPassword?: string; newPassword: string }) =>
      api.changePassword(body),
  });
}

export function useResolveInviteQuery(token: string) {
  return useQuery({
    queryKey: ["invite", "resolve", token],
    queryFn: () => api.resolveInvite(token),
    enabled: Boolean(token),
    retry: false,
  });
}
