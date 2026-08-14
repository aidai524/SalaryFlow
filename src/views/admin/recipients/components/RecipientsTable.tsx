import { tokenLogoUrl } from "@/lib/logo";
import { cn } from "@/lib/utils";
import type { Employee } from "@/lib/api";
import { isVerified } from "../utils";
import {
  RecipientCompensationCell,
  RecipientNameCell,
  RecipientScheduleCell,
  RecipientTypeCell,
  RecipientWalletCell,
} from "./RecipientCells";
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
                  <RecipientNameCell employee={emp} />
                </td>
                <td className="px-3 py-3.5">
                  <RecipientTypeCell employee={emp} />
                </td>
                <td className="px-3 py-3.5">
                  <RecipientCompensationCell employee={emp} />
                </td>
                <td className="px-3 py-3.5">
                  <RecipientScheduleCell employee={emp} />
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
                  <RecipientWalletCell employee={emp} />
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
