import { useEffect, useState, type FormEvent, type ReactNode } from "react";
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
import { useCreateInviteMutation } from "@/hooks/use-recipients-api";
import useToast from "@/hooks/use-toast";
import type { RecipientRoleTitle } from "@/lib/api";
import { cn } from "@/lib/utils";
import { ROLE_OPTIONS } from "../config";

const SELECT_ICON = (
  <img src="/icons/to-down.svg" alt="" width={10} height={4} className="pointer-events-none size-auto shrink-0" />
);

export interface InviteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Prefill when inviting an existing recipient to verify. */
  initialEmail?: string;
  initialName?: string;
  initialRoleTitle?: RecipientRoleTitle | string;
}

export function InviteDialog({
  open,
  onOpenChange,
  initialEmail = "",
  initialName = "",
  initialRoleTitle = "Developer",
}: InviteDialogProps) {
  const toast = useToast();
  const mutation = useCreateInviteMutation();
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [roleTitle, setRoleTitle] = useState<RecipientRoleTitle>(
    ROLE_OPTIONS.find((r) => r.value === initialRoleTitle)?.value || "Developer",
  );

  useEffect(() => {
    if (!open) return;
    setName(initialName);
    setEmail(initialEmail);
    setRoleTitle(
      ROLE_OPTIONS.find((r) => r.value === initialRoleTitle)?.value || "Developer",
    );
  }, [open, initialEmail, initialName, initialRoleTitle]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      toast.fail({ title: "Name is required" });
      return;
    }
    if (!email.trim()) {
      toast.fail({ title: "Email is required" });
      return;
    }
    try {
      const result = await mutation.mutateAsync({
        name: name.trim(),
        email: email.trim(),
        role: "employee",
        role_title: roleTitle,
        employee_type: "employee",
      });
      const recipient = email.trim();
      if (result.inviteUrl) {
        toast.success({
          title: result.resent ? "Invitation resent" : "Invitation created",
          text: result.inviteUrl,
          duration: 8000,
        });
      } else {
        toast.success({
          title: result.resent
            ? `Invitation resent to ${recipient}`
            : `Invitation sent to ${recipient}`,
        });
      }
      onOpenChange(false);
    } catch (cause) {
      toast.fail({
        title: cause instanceof Error ? cause.message : "Failed to send invitation",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className="max-w-[500px] gap-0 rounded-[20px] border border-white bg-[#fdfdfd] p-0 shadow-[0px_0px_20px_0px_rgba(0,0,0,0.06)] sm:max-w-[500px]"
      >
        <DialogHeader className="space-y-2 px-6 pt-6 pb-1 text-left">
          <DialogTitle className="font-montserrat text-[16px] font-semibold text-black">
            Invite
          </DialogTitle>
          <p className="font-montserrat text-[12px] font-normal text-[#909090]">
            Invite a colleague to create their own DECash account.
          </p>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4 px-6 pt-4 pb-6">
          <Field label="Name">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Andrew"
              className={fieldInputClass}
            />
          </Field>
          <Field label="Email">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="name@company.com"
              className={fieldInputClass}
            />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Type">
              <Select value="employee" disabled>
                <SelectTrigger icon={SELECT_ICON} className={selectTriggerClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">Employee</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Role">
              <Select
                value={roleTitle}
                onValueChange={(v) => setRoleTitle(v as RecipientRoleTitle)}
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
          </div>

          <button
            type="submit"
            disabled={mutation.isPending}
            className="mt-2 inline-flex h-14 w-full items-center justify-center rounded-[12px] bg-black font-montserrat text-[16px] font-medium text-white shadow-[0px_0px_6px_0px_rgba(0,0,0,0.06)] transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {mutation.isPending ? "Sending…" : "Send an invitation"}
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
      <span className="font-montserrat text-[14px] font-medium text-[#909090]">{label}</span>
      {children}
    </label>
  );
}

const fieldInputClass =
  "h-10 w-full rounded-[6px] border border-[#e3e3e3] bg-[#f6f6f6] px-3 font-montserrat text-[14px] font-medium text-black outline-none placeholder:text-[#aaa] focus:border-black/30";

const selectTriggerClass =
  "h-10 w-full data-[size=default]:h-10 rounded-[6px] border border-[#e3e3e3] bg-white px-3 font-montserrat text-[14px] font-medium text-black";
