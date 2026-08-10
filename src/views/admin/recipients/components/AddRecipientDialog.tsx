import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { PayoutOwnershipActions } from "@/components/PayoutOwnershipActions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PHASE1_CHAINS } from "@/config/chains";
import {
  myPayoutQueryKey,
  useUpdateMyProfileMutation,
} from "@/hooks/use-employee-api";
import { usePayoutOwnership } from "@/hooks/use-payout-ownership";
import {
  employeeDetailQueryKey,
  useCreateEmployeeMutation,
  useUpdateEmployeeMutation,
} from "@/hooks/use-recipients-api";
import useToast from "@/hooks/use-toast";
import {
  api,
  type ContractorPaymentCadence,
  type Employee,
  type EmployeeType,
  type MyPayout,
  type RecipientRoleTitle,
  type TeamPaymentDateKey,
  type TeamPaymentSchedule,
} from "@/lib/api";
import { formatTokenMinor } from "@/lib/format";
import { notifyPayoutUpdated } from "@/lib/payout-events";
import { preventRainbowKitDialogDismiss } from "@/lib/rainbowkit-overlay";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth";
import {
  defaultPaymentDateForSchedule,
  paymentDateOptionsForSchedule,
} from "@/views/admin/create-team/utils";
import {
  CONTRACTOR_SCHEDULE_OPTIONS,
  ROLE_OPTIONS,
  TOKEN_OPTIONS,
} from "../config";

function toSavedPayout(emp: Employee, totalReceivedMinor = 0): MyPayout {
  return {
    id: emp.id,
    name: emp.name,
    email: emp.email,
    role_title: emp.role_title,
    employee_type: emp.employee_type,
    token: emp.token,
    network: emp.network,
    amount_minor: emp.amount_minor,
    endpoint: emp.endpoint,
    status: emp.status,
    payout_verified_at: emp.payout_verified_at,
    last_paid_at: emp.last_paid_at,
    created_at: emp.created_at,
    payment_cadence: emp.payment_cadence,
    payment_date_key: emp.payment_date_key,
    nextPayday: emp.nextPayday,
    nextPaydayDisplay: emp.nextPaydayDisplay,
    totalReceivedMinor,
  };
}

function employeeFromMyPayout(payout: MyPayout, userId: string | null): Employee {
  return {
    id: payout.id,
    user_id: userId,
    email: payout.email,
    name: payout.name,
    role_title: payout.role_title || "",
    location: "",
    employee_type: payout.employee_type,
    token: payout.token,
    network: payout.network,
    amount_minor: payout.amount_minor,
    endpoint: payout.endpoint,
    status: payout.status,
    payout_verified_at: payout.payout_verified_at,
    last_paid_at: payout.last_paid_at,
    created_at: payout.created_at,
    payment_cadence: payout.payment_cadence,
    payment_date_key: payout.payment_date_key,
    nextPayday: payout.nextPayday,
    nextPaydayDisplay: payout.nextPaydayDisplay,
  };
}

const SELECT_ICON = (
  <img src="/icons/to-down.svg" alt="" width={10} height={4} className="pointer-events-none size-auto shrink-0" />
);

export interface AddRecipientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "add" | "edit";
  /** admin = full form; self = employee profile edit (limited fields). */
  variant?: "admin" | "self";
  employee?: Employee | null;
  teamCadence: TeamPaymentSchedule;
  teamPaymentDate: TeamPaymentDateKey;
}

interface FormState {
  name: string;
  email: string;
  employee_type: EmployeeType;
  role_title: RecipientRoleTitle;
  amount: string;
  payment_cadence: ContractorPaymentCadence;
  payment_date_key: TeamPaymentDateKey;
  token: "USDC" | "USDT";
  network: string;
  endpoint: string;
}

function emptyForm(
  teamCadence: TeamPaymentSchedule,
  teamPaymentDate: TeamPaymentDateKey,
): FormState {
  return {
    name: "",
    email: "",
    employee_type: "contractor",
    role_title: "Developer",
    amount: "",
    payment_cadence: teamCadence,
    payment_date_key: teamPaymentDate,
    token: "USDC",
    network: "Base",
    endpoint: "",
  };
}

function fromEmployee(
  emp: Employee,
  teamCadence: TeamPaymentSchedule,
  teamPaymentDate: TeamPaymentDateKey,
): FormState {
  const cadence =
    emp.employee_type === "employee"
      ? teamCadence
      : ((emp.payment_cadence as ContractorPaymentCadence) || teamCadence);
  return {
    name: emp.name || "",
    email: emp.email || "",
    employee_type: emp.employee_type,
    role_title: (ROLE_OPTIONS.find((r) => r.value === emp.role_title)?.value || "Developer"),
    amount: formatTokenMinor(emp.amount_minor, { maximumFractionDigits: 6 }).replace(/,/g, ""),
    payment_cadence: cadence,
    payment_date_key:
      emp.employee_type === "employee"
        ? teamPaymentDate
        : ((emp.payment_date_key as TeamPaymentDateKey) || defaultPaymentDateForSchedule(teamCadence)),
    token: emp.token || "USDC",
    network: emp.network || "Base",
    endpoint: emp.endpoint || "",
  };
}

export function AddRecipientDialog({
  open,
  onOpenChange,
  mode,
  variant = "admin",
  employee,
  teamCadence,
  teamPaymentDate,
}: AddRecipientDialogProps) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const setUser = useAuthStore((s) => s.setUser);
  const user = useAuthStore((s) => s.user);
  const orgId = useAuthStore((s) => s.orgId);
  const createMutation = useCreateEmployeeMutation();
  const updateMutation = useUpdateEmployeeMutation();
  const selfUpdateMutation = useUpdateMyProfileMutation();
  const isSelf = variant === "self";
  const [form, setForm] = useState<FormState>(() => emptyForm(teamCadence, teamPaymentDate));
  const [savedPayout, setSavedPayout] = useState<MyPayout | null>(null);
  const [needsVerify, setNeedsVerify] = useState(false);
  const [formReady, setFormReady] = useState(false);
  const [loadError, setLoadError] = useState("");

  // Fetch latest profile whenever the dialog opens (admin GET by id / employee myPayout).
  useEffect(() => {
    if (!open) {
      setFormReady(false);
      setLoadError("");
      return;
    }

    let cancelled = false;

    const seedFromEmployee = (emp: Employee, payout?: MyPayout | null) => {
      setForm(fromEmployee(emp, teamCadence, teamPaymentDate));
      if (isSelf) {
        const next = payout ?? toSavedPayout(emp);
        setSavedPayout(next);
        setNeedsVerify(!(next.payout_verified_at && next.status === "ready"));
      } else {
        setSavedPayout(null);
        setNeedsVerify(false);
      }
    };

    (async () => {
      setFormReady(false);
      setLoadError("");
      try {
        if (mode === "add") {
          if (cancelled) return;
          setForm(emptyForm(teamCadence, teamPaymentDate));
          setSavedPayout(null);
          setNeedsVerify(false);
          setFormReady(true);
          return;
        }

        if (isSelf) {
          const data = await queryClient.fetchQuery({
            queryKey: myPayoutQueryKey(orgId),
            queryFn: () => api.myPayout(),
          });
          if (cancelled) return;
          if (!data.payout) {
            setLoadError("Unable to load your profile");
            setFormReady(true);
            return;
          }
          seedFromEmployee(
            employeeFromMyPayout(data.payout, user?.id ?? null),
            data.payout,
          );
          setFormReady(true);
          return;
        }

        const employeeId = employee?.id;
        if (!employeeId) {
          setLoadError("Employee not found");
          setFormReady(true);
          return;
        }
        const data = await queryClient.fetchQuery({
          queryKey: employeeDetailQueryKey(orgId, employeeId),
          queryFn: () => api.getEmployee(employeeId),
        });
        if (cancelled) return;
        seedFromEmployee(data.employee);
        setFormReady(true);
      } catch (cause) {
        if (cancelled) return;
        setLoadError(cause instanceof Error ? cause.message : "Unable to load profile");
        // Fallback to prop so the dialog is still usable offline-ish.
        if (mode === "edit" && employee) {
          seedFromEmployee(employee, isSelf ? toSavedPayout(employee) : null);
        }
        setFormReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
    // Intentionally seed only when the dialog opens or the edit target changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, isSelf, employee?.id]);

  const setEndpoint = (value: string) => {
    setForm((prev) => ({ ...prev, endpoint: value }));
  };

  const ownership = usePayoutOwnership({
    token: form.token,
    network: form.network,
    endpoint: form.endpoint,
    setEndpoint,
    savedPayout,
    onVerified: async (next) => {
      setSavedPayout(next);
      setNeedsVerify(false);
      notifyPayoutUpdated();
      if (user) {
        setUser({
          ...user,
          name: next.name || user.name,
          email: next.email || user.email,
          wallet_address: next.endpoint,
          wallet_verified: true,
        });
      }
      toast.success({ title: "Wallet ownership verified" });
      onOpenChange(false);
    },
    onDirty: () => setNeedsVerify(true),
  });

  useEffect(() => {
    ownership.setNotice("");
    ownership.setError("");
    // Reset prompt state whenever the dialog opens/closes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const isEmployee = form.employee_type === "employee";
  const scheduleLocked = isEmployee;
  const showPaymentDate = !isEmployee && form.payment_cadence !== "on_demand";

  const dateOptions = useMemo(() => {
    if (isEmployee) return paymentDateOptionsForSchedule(teamCadence);
    if (form.payment_cadence === "on_demand") return [];
    return paymentDateOptionsForSchedule(form.payment_cadence);
  }, [isEmployee, teamCadence, form.payment_cadence]);

  const displayCadence = isEmployee ? teamCadence : form.payment_cadence;
  const displayDate = isEmployee ? teamPaymentDate : form.payment_date_key;

  const busy =
    !formReady
    || createMutation.isPending
    || updateMutation.isPending
    || selfUpdateMutation.isPending
    || ownership.verifying;

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (isSelf && (key === "token" || key === "network" || key === "endpoint")) {
      setNeedsVerify(true);
      ownership.setNotice("");
      ownership.setError("");
    }
  };

  const onTypeChange = (type: EmployeeType) => {
    setForm((prev) => ({
      ...prev,
      employee_type: type,
      payment_cadence: type === "employee" ? teamCadence : prev.payment_cadence,
      payment_date_key: type === "employee" ? teamPaymentDate : prev.payment_date_key,
    }));
  };

  const onScheduleChange = (cadence: ContractorPaymentCadence) => {
    setForm((prev) => ({
      ...prev,
      payment_cadence: cadence,
      payment_date_key:
        cadence === "on_demand"
          ? prev.payment_date_key
          : defaultPaymentDateForSchedule(cadence),
    }));
  };

  const submitSelf = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.name.trim()) {
      toast.fail({ title: "Name is required" });
      return;
    }
    if (!form.token || !form.network) {
      toast.fail({ title: "Token and network are required" });
      return;
    }
    if (!form.endpoint.trim()) {
      toast.fail({ title: "Wallet address is required" });
      return;
    }

    try {
      const result = await selfUpdateMutation.mutateAsync({
        name: form.name.trim(),
        email: form.email.trim() || null,
        token: form.token,
        network: form.network,
        endpoint: form.endpoint.trim(),
      });
      if (result.payout) setSavedPayout(result.payout);
      if (result.payoutChanged) {
        setNeedsVerify(true);
        toast.info({ title: "Profile saved. Verify wallet ownership to activate payout." });
        return;
      }
      toast.success({ title: "Profile updated" });
      onOpenChange(false);
    } catch (cause) {
      toast.fail({
        title: cause instanceof Error ? cause.message : "Failed to save profile",
      });
    }
  };

  const submitAdmin = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.name.trim()) {
      toast.fail({ title: "Name is required" });
      return;
    }
    if (!form.amount.trim() || Number(form.amount) <= 0) {
      toast.fail({ title: "Enter a valid compensation amount" });
      return;
    }

    const body = {
      name: form.name.trim(),
      email: form.email.trim() || null,
      employee_type: form.employee_type,
      role_title: form.role_title,
      amount: form.amount.trim(),
      token: form.token,
      network: form.network,
      endpoint: form.endpoint.trim(),
      ...(form.employee_type === "contractor"
        ? {
            payment_cadence: form.payment_cadence,
            payment_date_key:
              form.payment_cadence === "on_demand" ? null : form.payment_date_key,
          }
        : {
            payment_cadence: undefined,
            payment_date_key: null,
          }),
    };

    try {
      if (mode === "edit" && employee) {
        await updateMutation.mutateAsync({ id: employee.id, body });
        toast.success({ title: "Recipient updated" });
      } else {
        await createMutation.mutateAsync(body);
        toast.success({ title: "Recipient added" });
      }
      onOpenChange(false);
    } catch (cause) {
      toast.fail({
        title: cause instanceof Error ? cause.message : "Failed to save recipient",
      });
    }
  };

  const title = isSelf
    ? "Edit Profile"
    : mode === "edit"
      ? "Edit Recipient"
      : "Add Recipient";
  const submitLabel = isSelf
    ? "Save"
    : mode === "edit"
      ? "Update"
      : "Add Recipient";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className="max-h-[90vh] max-w-[600px] gap-0 overflow-y-auto rounded-[24px] p-0 sm:max-w-[600px]"
        onPointerDownOutside={isSelf ? preventRainbowKitDialogDismiss : undefined}
        onInteractOutside={isSelf ? preventRainbowKitDialogDismiss : undefined}
        onFocusOutside={isSelf ? preventRainbowKitDialogDismiss : undefined}
      >
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="font-montserrat text-[20px] font-semibold text-black">
            {title}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={isSelf ? submitSelf : submitAdmin} className="px-6 pb-6">
          {!formReady ? (
            <p className="py-16 text-center font-montserrat text-[14px] text-[#909090]">
              Loading profile…
            </p>
          ) : null}

          {formReady && loadError ? (
            <p className="mb-4 rounded-[12px] bg-[#fff1f1] px-3 py-2 font-montserrat text-[12px] text-red-600">
              {loadError}. Showing last known values.
            </p>
          ) : null}

          <div className={cn(!formReady && "pointer-events-none invisible h-0 overflow-hidden")}>
          <div className="mb-5 flex flex-col items-center">
            <button
              type="button"
              onClick={() => toast.info({ title: "Photo upload coming soon" })}
              className="inline-flex size-20 items-center justify-center rounded-full bg-[#f6f6f6] transition-colors hover:bg-black/5"
              aria-label="Add photo"
            >
              <img src="/icons/camera.svg" alt="" className="size-6 opacity-60" />
            </button>
            <p className="mt-2 font-montserrat text-[12px] text-[#909090]">Add Photo</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name (Required)" className="sm:col-span-2">
              <input
                value={form.name}
                onChange={(e) => setField("name", e.target.value)}
                className={fieldInputClass}
                placeholder="Full name"
                required
              />
            </Field>

            {!isSelf && (
              <>
                <Field label="Type">
                  <Select
                    value={form.employee_type}
                    onValueChange={(v) => onTypeChange(v as EmployeeType)}
                  >
                    <SelectTrigger icon={SELECT_ICON} className={selectTriggerClass}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="employee">Employee</SelectItem>
                      <SelectItem value="contractor">Contractor</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Role">
                  <Select
                    value={form.role_title}
                    onValueChange={(v) => setField("role_title", v as RecipientRoleTitle)}
                  >
                    <SelectTrigger icon={SELECT_ICON} className={selectTriggerClass}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </>
            )}

            <Field label="Email" className={isSelf ? "sm:col-span-2" : undefined}>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setField("email", e.target.value)}
                className={fieldInputClass}
                placeholder="name@company.com"
              />
            </Field>

            {!isSelf && (
              <>
                <Field label="Compensation">
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-montserrat text-[14px] text-[#909090]">
                      $
                    </span>
                    <input
                      value={form.amount}
                      onChange={(e) => setField("amount", e.target.value)}
                      className={cn(fieldInputClass, "pl-7")}
                      placeholder="5,000"
                      inputMode="decimal"
                      required
                    />
                  </div>
                </Field>
                <Field label="Schedule">
                  <Select
                    value={displayCadence}
                    onValueChange={(v) => onScheduleChange(v as ContractorPaymentCadence)}
                    disabled={scheduleLocked}
                  >
                    <SelectTrigger
                      icon={SELECT_ICON}
                      className={cn(selectTriggerClass, scheduleLocked && "opacity-60")}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(isEmployee
                        ? CONTRACTOR_SCHEDULE_OPTIONS.filter((o) => o.value !== "on_demand")
                        : CONTRACTOR_SCHEDULE_OPTIONS
                      ).map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                {(isEmployee || showPaymentDate) && (
                  <Field label="Payment Date">
                    <Select
                      value={displayDate}
                      onValueChange={(v) => setField("payment_date_key", v as TeamPaymentDateKey)}
                      disabled={scheduleLocked}
                    >
                      <SelectTrigger
                        icon={SELECT_ICON}
                        className={cn(selectTriggerClass, scheduleLocked && "opacity-60")}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {dateOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                )}
              </>
            )}

            <Field label={isSelf ? "Received Token (Required)" : "Token"}>
              <Select
                value={form.token}
                onValueChange={(v) => setField("token", v as "USDC" | "USDT")}
              >
                <SelectTrigger icon={SELECT_ICON} className={selectTriggerClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TOKEN_OPTIONS.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label={isSelf ? "Network (Required)" : "Network"}>
              <Select value={form.network} onValueChange={(v) => setField("network", v)}>
                <SelectTrigger icon={SELECT_ICON} className={selectTriggerClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PHASE1_CHAINS.map((c) => (
                    <SelectItem key={c.blockchain} value={c.chainName}>
                      {c.chainName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field
              label={isSelf ? "Wallet Address (Required)" : "Wallet"}
              className="sm:col-span-2"
            >
              <input
                value={form.endpoint}
                onChange={(e) => setField("endpoint", e.target.value)}
                className={fieldInputClass}
                placeholder="0x…"
                required={isSelf}
              />
            </Field>
          </div>

          {isSelf && (needsVerify || !ownership.ownershipVerified) && (
            <div className="mt-5 rounded-[16px] border border-black/10 bg-[#f6f6f6] p-4">
              <p className="font-montserrat text-[14px] font-medium text-black">
                Verify wallet ownership
              </p>
              <p className="mt-1 font-montserrat text-[12px] leading-5 text-[#606060]">
                Sign a one-time message to prove you control this address. It cannot move funds.
              </p>
              <PayoutOwnershipActions
                ownershipVerified={ownership.ownershipVerified}
                connectedAddressMatches={ownership.connectedAddressMatches}
                isConnected={ownership.isConnected}
                address={ownership.address}
                verifiedEndpoint={ownership.verifiedEndpoint}
                verifying={ownership.verifying}
                onConnect={ownership.connectWallet}
                onChangeWallet={ownership.changeConnectedWallet}
                onUseAddress={ownership.useConnectedAddress}
                onVerify={ownership.verifyWallet}
              />
              {ownership.error ? (
                <p className="mt-2 font-montserrat text-[12px] text-red-600">{ownership.error}</p>
              ) : null}
              {ownership.notice ? (
                <p className="mt-2 font-montserrat text-[12px] text-[#0cb400]">{ownership.notice}</p>
              ) : null}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-[24px] bg-black font-montserrat text-[15px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {!formReady ? "Loading…" : busy ? "Saving…" : submitLabel}
          </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("flex flex-col gap-1.5", className)}>
      <span className="font-montserrat text-[12px] font-medium text-[#606060]">{label}</span>
      {children}
    </label>
  );
}

const fieldInputClass =
  "h-9 w-full rounded-[6px] border border-[#e3e3e3] bg-white px-3 font-montserrat text-[14px] text-black outline-none placeholder:text-[#aaa] focus:border-black/30";

const selectTriggerClass =
  "h-9 w-full data-[size=default]:h-9 rounded-[6px] border border-[#e3e3e3] bg-white px-3 font-montserrat text-[14px] text-black";
