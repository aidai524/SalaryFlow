import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  api,
  type Employee,
  type EmployeeType,
  type ListEmployeesParams,
  type TeamPaymentDateKey,
  type ContractorPaymentCadence,
} from "@/lib/api";
import { useAuthStore } from "@/stores/auth";
import { HISTORY_PAGE_SIZE } from "@/views/admin/recipients/config";

export function recipientsQueryKey(
  orgId: string | null | undefined,
  params: ListEmployeesParams,
) {
  return ["recipients", orgId ?? "none", params] as const;
}

export function employeesQueryKey(orgId: string | null | undefined) {
  return ["employees", orgId ?? "none"] as const;
}

export function employeePaymentsQueryKey(
  orgId: string | null | undefined,
  employeeId: string | null | undefined,
) {
  return ["employee-payments", orgId ?? "none", employeeId ?? "none"] as const;
}

async function invalidateRecipientLists(queryClient: ReturnType<typeof useQueryClient>, orgId: string | null) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["recipients"] }),
    queryClient.invalidateQueries({ queryKey: ["employees"] }),
    queryClient.invalidateQueries({ queryKey: ["pay-overview", orgId] }),
    queryClient.invalidateQueries({ queryKey: ["org-overview"] }),
    queryClient.invalidateQueries({ queryKey: ["org-payments"] }),
  ]);
}

export function useRecipientsQuery(
  params: ListEmployeesParams,
  options?: { enabled?: boolean },
) {
  const orgId = useAuthStore((s) => s.orgId);
  const enabled = options?.enabled ?? true;
  return useQuery({
    queryKey: recipientsQueryKey(orgId, params),
    queryFn: () => api.listEmployees(params),
    enabled: !!orgId && enabled,
    placeholderData: (prev) => prev,
  });
}

export function useEmployeePaymentsInfiniteQuery(employeeId: string | null | undefined) {
  const orgId = useAuthStore((s) => s.orgId);
  return useInfiniteQuery({
    queryKey: employeePaymentsQueryKey(orgId, employeeId),
    queryFn: ({ pageParam }) =>
      api.listEmployeePayments(employeeId!, {
        limit: HISTORY_PAGE_SIZE,
        cursor: pageParam ?? null,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    enabled: !!orgId && !!employeeId,
  });
}

export function employeeDetailQueryKey(
  orgId: string | null | undefined,
  employeeId: string | null | undefined,
) {
  return ["employee-detail", orgId ?? "none", employeeId ?? "none"] as const;
}

export function useEmployeeQuery(
  employeeId: string | null | undefined,
  options?: { enabled?: boolean },
) {
  const orgId = useAuthStore((s) => s.orgId);
  const enabled = options?.enabled ?? true;
  return useQuery({
    queryKey: employeeDetailQueryKey(orgId, employeeId),
    queryFn: () => api.getEmployee(employeeId!),
    enabled: !!orgId && !!employeeId && enabled,
  });
}

type EmployeeWriteBody = Partial<Employee> & {
  amount?: string;
  employee_type?: EmployeeType;
  payment_cadence?: ContractorPaymentCadence;
  payment_date_key?: TeamPaymentDateKey | null;
};

export function useCreateEmployeeMutation() {
  const orgId = useAuthStore((s) => s.orgId);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: EmployeeWriteBody) => api.createEmployee(body),
    onSuccess: async () => {
      await invalidateRecipientLists(queryClient, orgId);
    },
  });
}

export function useUpdateEmployeeMutation() {
  const orgId = useAuthStore((s) => s.orgId);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: EmployeeWriteBody }) =>
      api.updateEmployee(id, body),
    onSuccess: async (_data, variables) => {
      await Promise.all([
        invalidateRecipientLists(queryClient, orgId),
        queryClient.invalidateQueries({
          queryKey: employeeDetailQueryKey(orgId, variables.id),
        }),
      ]);
    },
  });
}

export function useDeleteEmployeeMutation() {
  const orgId = useAuthStore((s) => s.orgId);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteEmployee(id),
    onSuccess: async () => {
      await invalidateRecipientLists(queryClient, orgId);
    },
  });
}

export function useCreateInviteMutation() {
  const orgId = useAuthStore((s) => s.orgId);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      email: string;
      name: string;
      role?: string;
      role_title?: string;
      employee_type?: EmployeeType;
    }) => api.createInvite(body),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["invites"] }),
        invalidateRecipientLists(queryClient, orgId),
      ]);
    },
  });
}
