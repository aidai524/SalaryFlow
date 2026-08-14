import { IdentityAvatar } from "@/components/IdentityAvatar";
import { IconAlert } from "@/components/icons/alert";
import { IconCheck } from "@/components/icons/check";
import type { Employee } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  formatCompensation,
  isVerified,
  roleBadgeAbbrev,
  scheduleLabel,
  typeLabel,
} from "../utils";

export function RecipientNameCell({ employee }: { employee: Employee }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <IdentityAvatar
        seed={employee.name || employee.email || employee.id}
        src={employee.avatar_url}
        size={36}
        alt=""
      />
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="truncate font-montserrat text-[14px] font-medium text-black">
            {employee.name}
          </span>
        </div>
        <span
          className={cn(
            "inline-flex items-center rounded-[10px] font-montserrat text-[10px] font-medium leading-[100%]",
          )}
        >
          {roleBadgeAbbrev(employee.role_title)}
        </span>
      </div>
    </div>
  );
}

export function RecipientTypeCell({ employee }: { employee: Employee }) {
  return (
    <span className="font-montserrat text-[13px] text-black">
      {typeLabel(employee.employee_type)}
    </span>
  );
}

export function RecipientCompensationCell({ employee }: { employee: Employee }) {
  return (
    <span className="font-montserrat text-[13px] font-medium text-black">
      {formatCompensation(employee)}
    </span>
  );
}

export function RecipientScheduleCell({ employee }: { employee: Employee }) {
  return (
    <span className="font-montserrat text-[13px] text-black">
      {scheduleLabel(employee.payment_cadence)}
    </span>
  );
}

export function RecipientWalletCell({ employee }: { employee: Pick<Employee, "payout_verified_at" | "status"> }) {
  const verified = isVerified(employee);
  if (verified) {
    return (
      <span className="inline-flex h-[24px] items-center gap-1.5 rounded-[12px] bg-[#0ED000]/10 p-[6px_10px_6px_6px] font-montserrat text-[12px] text-[#0ed000]">
        <span className="inline-flex size-4 items-center justify-center rounded-full bg-[#0ed000] text-white">
          <IconCheck className="size-2" />
        </span>
        Verified
      </span>
    );
  }
  return (
    <span className="inline-flex h-[24px] items-center gap-1.5 rounded-[12px] bg-[#AAA]/10 p-[6px_10px_6px_6px] font-montserrat text-[12px] text-[#AAA]">
      <span className="inline-flex size-4 items-center justify-center rounded-full bg-[#AAAAAA] text-[#fff]">
        <IconAlert className="size-2" />
      </span>
      Unverified
    </span>
  );
}
