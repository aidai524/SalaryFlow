import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Pagination from "@/components/pagination";
import { IconLink } from "@/components/icons/link";
import { periodKeyFromDate } from "@/components/payment-period-picker/PaymentPeriodPicker";
import { useOrgContextQuery } from "@/hooks/use-org-api";
import { useEmployeeQuery, useRecipientsQuery } from "@/hooks/use-recipients-api";
import useToast from "@/hooks/use-toast";
import {
  type Employee,
  type TeamPaymentDateKey,
  type TeamPaymentSchedule,
} from "@/lib/api";
import { useAuthStore } from "@/stores/auth";
import { DEFAULT_MONTHLY_PAYMENT_DATE, DEFAULT_PAYMENT_SCHEDULE } from "./create-team/config";
import { PAGE_SIZE, type TypeFilter } from "./recipients/config";
import { AddRecipientDialog } from "./recipients/components/AddRecipientDialog";
import { InviteDialog } from "./recipients/components/InviteDialog";
import { PayNowDialog } from "./recipients/components/PayNowDialog";
import { RecipientDetailCard } from "./recipients/components/RecipientDetailCard";
import { RecipientsTable } from "./recipients/components/RecipientsTable";
import { RecipientsToolbar } from "./recipients/components/RecipientsToolbar";
import { RemoveRecipientDialog } from "./recipients/components/RemoveRecipientDialog";
import { isVerified } from "./recipients/utils";

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

export function RecipientsView() {
  const orgId = useAuthStore((s) => s.orgId);
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const orgContextQuery = useOrgContextQuery(orgId);
  const teamCadence: TeamPaymentSchedule =
    orgContextQuery.data?.org.payment_cadence || DEFAULT_PAYMENT_SCHEDULE;
  const teamPaymentDate: TeamPaymentDateKey =
    orgContextQuery.data?.org.payment_date_key || DEFAULT_MONTHLY_PAYMENT_DATE;

  const [periodKey, setPeriodKey] = useState(() => periodKeyFromDate(teamCadence));
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search, 300);

  const [selectedId, setSelectedId] = useState<string | null>(
    () => searchParams.get("selected"),
  );

  const [addOpen, setAddOpen] = useState(false);
  const [editEmployee, setEditEmployee] = useState<Employee | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState<string>("Developer");
  const [removeEmployee, setRemoveEmployee] = useState<Employee | null>(null);
  const [payEmployeeId, setPayEmployeeId] = useState<string | null>(null);

  useEffect(() => {
    setPeriodKey(periodKeyFromDate(teamCadence));
  }, [teamCadence]);

  useEffect(() => {
    setPage(1);
  }, [typeFilter, debouncedSearch]);

  const listParams = useMemo(
    () => ({
      q: debouncedSearch.trim() || undefined,
      type: typeFilter === "all" ? undefined : typeFilter,
      page,
      pageSize: PAGE_SIZE,
    }),
    [debouncedSearch, typeFilter, page],
  );

  const recipientsQuery = useRecipientsQuery(listParams);
  const employees = recipientsQuery.data?.employees ?? [];
  const total = recipientsQuery.data?.total ?? 0;
  const counts = recipientsQuery.data?.counts ?? {
    all: 0,
    employees: 0,
    contractors: 0,
    others: 0,
  };
  const totalPage = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const selectedFromList = employees.find((e) => e.id === selectedId) || null;
  const needDetail = !!selectedId && !recipientsQuery.isLoading && !selectedFromList;
  const employeeQuery = useEmployeeQuery(selectedId, { enabled: needDetail });

  useEffect(() => {
    const fromUrl = searchParams.get("selected");
    if (!fromUrl) return;
    setSelectedId(fromUrl);
  }, [searchParams]);

  const selectedEmployee = selectedFromList || employeeQuery.data?.employee || null;

  const selectEmployee = (employee: Employee) => {
    setSelectedId(employee.id);
    const next = new URLSearchParams(searchParams);
    next.set("selected", employee.id);
    setSearchParams(next, { replace: true });
  };

  const clearSelectionIfRemoved = (id: string) => {
    if (selectedId === id) {
      setSelectedId(null);
      const next = new URLSearchParams(searchParams);
      next.delete("selected");
      setSearchParams(next, { replace: true });
    }
  };

  const openInviteFor = (employee?: Employee | null) => {
    setInviteEmail(employee?.email || "");
    setInviteName(employee?.name || "");
    setInviteRole(employee?.role_title || "Developer");
    setInviteOpen(true);
  };

  const openInviteToVerify = (employee: Employee) => {
    if (isVerified(employee)) {
      toast.fail({ title: "Recipient is already verified" });
      return;
    }
    if (!employee.email) {
      toast.fail({ title: "Recipient has no email to invite" });
      return;
    }
    openInviteFor(employee);
  };

  return (
    <div className="pb-10 pt-4 md:pt-5">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-montserrat text-[22px] font-medium text-black sm:text-[26px]">
            Recipients
          </h1>
          <p className="mt-1 font-montserrat text-[13px] text-[#606060]">
            Manage your team members and their payout methods
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => openInviteFor(null)}
            className="inline-flex h-10 items-center gap-2 rounded-[20px] bg-black px-4 font-montserrat text-[13px] font-medium text-white transition-opacity hover:opacity-90"
          >
            <IconLink className="size-3.5" />
            Invite
          </button>
          <button
            type="button"
            onClick={() => {
              setEditEmployee(null);
              setAddOpen(true);
            }}
            className="inline-flex h-10 items-center gap-2 rounded-[20px] border border-black/15 bg-white px-4 font-montserrat text-[13px] font-medium text-black transition-colors hover:bg-black/5"
          >
            <img src="/icons/plus.svg" alt="" className="size-3.5" />
            Add Recipient
          </button>
        </div>
      </div>

      <RecipientsToolbar
        cadence={teamCadence}
        periodKey={periodKey}
        onPeriodChange={setPeriodKey}
        typeFilter={typeFilter}
        onTypeFilterChange={setTypeFilter}
        counts={counts}
        search={search}
        onSearchChange={setSearch}
        className="mb-4"
      />

      {recipientsQuery.isError ? (
        <p className="mb-4 font-montserrat text-[14px] text-red-600">
          {recipientsQuery.error instanceof Error
            ? recipientsQuery.error.message
            : "Failed to load recipients"}
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="overflow-hidden rounded-[20px] border border-white bg-[#fdfdfd] shadow-[0px_0px_20px_0px_rgba(0,0,0,0.06)]">
          <RecipientsTable
            employees={employees}
            selectedId={selectedId}
            onSelect={selectEmployee}
            onEdit={(emp) => {
              setEditEmployee(emp);
              setAddOpen(true);
            }}
            onInviteToVerify={openInviteToVerify}
            onPayNow={(emp) => setPayEmployeeId(emp.id)}
            onRemove={setRemoveEmployee}
            isLoading={recipientsQuery.isLoading}
          />
          <div className="flex items-center justify-end border-t border-black/5 px-5 py-3">
            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              totalPage={totalPage}
              onPageChange={setPage}
              className="!font-montserrat !text-[#606060] [&_path]:stroke-[#606060]"
            />
          </div>
        </section>

        {selectedEmployee ? (
          <RecipientDetailCard
            employee={selectedEmployee}
            onEdit={() => {
              setEditEmployee(selectedEmployee);
              setAddOpen(true);
            }}
            onPayNow={() => setPayEmployeeId(selectedEmployee.id)}
            className="xl:sticky xl:top-4 xl:self-start xl:max-h-[calc(100vh-2rem)]"
          />
        ) : (
          <div className="hidden items-center justify-center rounded-[20px] border border-dashed border-black/10 bg-white/60 px-6 py-16 text-center xl:flex">
            <p className="font-montserrat text-[14px] text-[#909090]">
              Select a recipient to view details
            </p>
          </div>
        )}
      </div>

      <AddRecipientDialog
        open={addOpen}
        onOpenChange={(open) => {
          setAddOpen(open);
          if (!open) setEditEmployee(null);
        }}
        mode={editEmployee ? "edit" : "add"}
        employee={editEmployee}
        teamCadence={teamCadence}
        teamPaymentDate={teamPaymentDate}
      />

      <InviteDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        initialEmail={inviteEmail}
        initialName={inviteName}
        initialRoleTitle={inviteRole}
      />

      <RemoveRecipientDialog
        open={Boolean(removeEmployee)}
        onOpenChange={(open) => {
          if (!open) setRemoveEmployee(null);
        }}
        employee={removeEmployee}
        onRemoved={clearSelectionIfRemoved}
      />

      <PayNowDialog
        open={Boolean(payEmployeeId)}
        onOpenChange={(open) => {
          if (!open) setPayEmployeeId(null);
        }}
        employeeId={payEmployeeId}
      />
    </div>
  );
}
