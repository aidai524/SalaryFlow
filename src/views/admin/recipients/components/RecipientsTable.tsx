import { IdentityAvatar } from "@/components/IdentityAvatar";
import { IconAlert } from "@/components/icons/alert";
import { IconCheck } from "@/components/icons/check";
import type { Employee } from "@/lib/api";
import { tokenLogoUrl } from "@/lib/logo";
import { cn } from "@/lib/utils";
import {
  formatCompensation,
  isVerified,
  roleBadgeAbbrev,
  scheduleLabel,
  typeLabel,
} from "../utils";
import { RecipientRowMenu } from "./RecipientRowMenu";

export interface RecipientsTableProps {
  employees: Employee[];
  selectedId: string | null;
  onSelect: (employee: Employee) => void;
  onEdit: (employee: Employee) => void;
  onInviteToVerify: (employee: Employee) => void;
  onPayNow: (employee: Employee) => void;
  onRemove: (employee: Employee) => void;
  isLoading?: boolean;
}

export function RecipientsTable({
  employees,
  selectedId,
  onSelect,
  onEdit,
  onInviteToVerify,
  onPayNow,
  onRemove,
  isLoading,
}: RecipientsTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[920px] border-collapse text-left">
        <thead>
          <tr className="border-b border-black/10">
            {["Name", "Type", "Compensation", "Schedule", "Payout", "Wallet", ""].map(
              (label) => (
                <th
                  key={label || "menu"}
                  className="px-3 py-3 font-montserrat text-[12px] font-medium capitalize text-[#909090] first:pl-5 last:pr-3"
                >
                  {label}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {employees.map((emp) => {
            const verified = isVerified(emp);
            const selected = selectedId === emp.id;
            return (
              <tr
                key={emp.id}
                onClick={() => onSelect(emp)}
                className={cn(
                  "cursor-pointer border-b border-black/5 transition-colors last:border-b-0",
                  selected ? "bg-[#f6f6f6]" : "hover:bg-[#fafafa]",
                )}
              >
                <td className="px-3 py-3.5 first:pl-5">
                  <div className="flex min-w-0 items-center gap-3">
                    <IdentityAvatar
                      seed={emp.name || emp.email || emp.id}
                      src={emp.avatar_url}
                      size={36}
                      alt=""
                    />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="truncate font-montserrat text-[14px] font-medium text-black">
                          {emp.name}
                        </span>
                      </div>
                      <span
                        className={cn(
                          "inline-flex items-center rounded-[10px] font-montserrat text-[10px] font-medium leading-[100%]",
                        )}
                      >
                        {roleBadgeAbbrev(emp.role_title)}
                      </span>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3.5 font-montserrat text-[13px] text-black">
                  {typeLabel(emp.employee_type)}
                </td>
                <td className="px-3 py-3.5 font-montserrat text-[13px] font-medium text-black">
                  {formatCompensation(emp)}
                </td>
                <td className="px-3 py-3.5 font-montserrat text-[13px] text-black">
                  {scheduleLabel(emp.payment_cadence)}
                </td>
                <td className="px-3 py-3.5">
                  <div className="flex items-center gap-1.5">
                    <img
                      src={tokenLogoUrl(emp.token)}
                      alt=""
                      className="size-4 rounded-full object-cover"
                    />
                    <span className="font-montserrat text-[12px] text-[#606060]">
                      {emp.token}
                    </span>
                    <span className="font-montserrat text-[12px] text-[#606060]">
                      ·
                    </span>
                    <span className="font-montserrat text-[12px] text-[#606060]">
                      {emp.network}
                    </span>
                  </div>
                </td>
                <td className="px-3 py-3.5">
                  {verified ? (
                    <span className="inline-flex items-center gap-1.5 p-[6px_10px_6px_6px] h-[24px] rounded-[12px] font-montserrat text-[12px] text-[#0ed000] bg-[#0ED000]/10">
                      <span className="inline-flex size-4 items-center justify-center rounded-full bg-[#0ed000] text-white">
                        <IconCheck className="size-2" />
                      </span>
                      Verified
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 p-[6px_10px_6px_6px] h-[24px] rounded-[12px] font-montserrat text-[12px] text-[#AAA] bg-[#AAA]/10">
                      <span className="inline-flex size-4 items-center justify-center rounded-full bg-[#AAAAAA] text-[#fff]">
                        <IconAlert className="size-2" />
                      </span>
                      Unverified
                    </span>
                  )}
                </td>
                <td className="px-3 py-3.5 last:pr-3">
                  <RecipientRowMenu
                    onEdit={() => onEdit(emp)}
                    onInviteToVerify={() => onInviteToVerify(emp)}
                    onPayNow={() => onPayNow(emp)}
                    onRemove={() => onRemove(emp)}
                    canInviteToVerify={!verified}
                  />
                </td>
              </tr>
            );
          })}
          {!isLoading && employees.length === 0 ? (
            <tr>
              <td
                colSpan={8}
                className="px-5 py-16 text-center font-montserrat text-[14px] text-[#909090]"
              >
                No recipients found
              </td>
            </tr>
          ) : null}
          {isLoading && employees.length === 0 ? (
            <tr>
              <td
                colSpan={8}
                className="px-5 py-16 text-center font-montserrat text-[14px] text-[#909090]"
              >
                Loading…
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
