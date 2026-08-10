import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
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
  useCreateEmployeeMutation,
  useUpdateEmployeeMutation,
} from "@/hooks/use-recipients-api";
import useToast from "@/hooks/use-toast";
import {
  type ContractorPaymentCadence,
  type Employee,
  type EmployeeType,
  type RecipientRoleTitle,
  type TeamPaymentDateKey,
  type TeamPaymentSchedule,
} from "@/lib/api";
import { formatTokenMinor } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  defaultPaymentDateForSchedule,
  paymentDateOptionsForSchedule,
} from "@/views/admin/create-team/utils";
import {
  CONTRACTOR_SCHEDULE_OPTIONS,
  ROLE_OPTIONS,
  TOKEN_OPTIONS,
} from "../config";

const SELECT_ICON = (
  <img src="/icons/to-down.svg" alt="" width={10} height={4} className="pointer-events-none size-auto shrink-0" />
);

export interface AddRecipientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "add" | "edit";
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
  employee,
  teamCadence,
  teamPaymentDate,
}: AddRecipientDialogProps) {
  const toast = useToast();
  const createMutation = useCreateEmployeeMutation();
  const updateMutation = useUpdateEmployeeMutation();
  const [form, setForm] = useState<FormState>(() => emptyForm(teamCadence, teamPaymentDate));

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && employee) {
      setForm(fromEmployee(employee, teamCadence, teamPaymentDate));
    } else {
      setForm(emptyForm(teamCadence, teamPaymentDate));
    }
  }, [open, mode, employee, teamCadence, teamPaymentDate]);

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

  const busy = createMutation.isPending || updateMutation.isPending;

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
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

  const submit = async (event: FormEvent) => {
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className="max-h-[90vh] max-w-[600px] gap-0 overflow-y-auto rounded-[24px] p-0 sm:max-w-[600px]"
      >
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="font-montserrat text-[20px] font-semibold text-black">
            {mode === "edit" ? "Edit Recipient" : "Add Recipient"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={submit} className="px-6 pb-6">
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
            <Field label="Email">
              <input
                type="email"
                value={form.email}
                onChange={(e) => setField("email", e.target.value)}
                className={fieldInputClass}
                placeholder="name@company.com"
              />
            </Field>
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
            <Field label="Token">
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
            <Field label="Network">
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
            <Field label="Wallet" className="sm:col-span-2">
              <input
                value={form.endpoint}
                onChange={(e) => setField("endpoint", e.target.value)}
                className={fieldInputClass}
                placeholder="0x…"
              />
            </Field>
          </div>

          <button
            type="submit"
            disabled={busy}
            className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-[24px] bg-black font-montserrat text-[15px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Saving…" : mode === "edit" ? "Update" : "Add Recipient"}
          </button>
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
