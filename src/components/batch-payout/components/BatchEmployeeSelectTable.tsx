import { useEffect, useRef } from "react";
import type { Employee } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  RecipientCompensationCell,
  RecipientNameCell,
  RecipientScheduleCell,
  RecipientTypeCell,
  RecipientWalletCell,
} from "@/views/admin/recipients/components/RecipientCells";
import {
  formatCompensation,
  scheduleLabel,
  typeLabel,
} from "@/views/admin/recipients/utils";

const CHECKBOX_CLASS = "size-4 cursor-pointer accent-black disabled:cursor-not-allowed";

export function BatchEmployeeSelectTable({
  employees,
  selectedIds,
  onToggle,
  onTogglePage,
  isLoading,
}: {
  employees: Employee[];
  selectedIds: Set<string>;
  onToggle: (employee: Employee, next: boolean) => void;
  onTogglePage: (next: boolean) => void;
  isLoading?: boolean;
}) {
  return (
    <div>
      <div className="hidden md:block">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-black/10">
              <th className="px-2 py-3 first:pl-3">
                <SelectAllCheckbox
                  employees={employees}
                  selectedIds={selectedIds}
                  onToggleAll={onTogglePage}
                />
              </th>
              {["Name", "Type", "Compensation", "Schedule", "Wallet"].map((label) => (
                <th
                  key={label}
                  className="px-2 py-3 font-montserrat text-[12px] font-medium capitalize text-[#909090] last:pr-3"
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {employees.map((emp) => {
              const checked = selectedIds.has(emp.id);
              return (
                <tr
                  key={emp.id}
                  onClick={() => onToggle(emp, !checked)}
                  className="cursor-pointer border-b border-black/5 last:border-b-0 hover:bg-[#fafafa]"
                >
                  <td className="px-2 py-3 first:pl-3">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(event) => onToggle(emp, event.target.checked)}
                      onClick={(event) => event.stopPropagation()}
                      className={CHECKBOX_CLASS}
                      aria-label={`Select ${emp.name}`}
                    />
                  </td>
                  <td className="px-2 py-3">
                    <RecipientNameCell employee={emp} />
                  </td>
                  <td className="px-2 py-3">
                    <RecipientTypeCell employee={emp} />
                  </td>
                  <td className="px-2 py-3">
                    <RecipientCompensationCell employee={emp} />
                  </td>
                  <td className="px-2 py-3">
                    <RecipientScheduleCell employee={emp} />
                  </td>
                  <td className="px-2 py-3 last:pr-3">
                    <RecipientWalletCell employee={emp} />
                  </td>
                </tr>
              );
            })}
            <EmptyRows colSpan={6} isLoading={isLoading} empty={employees.length === 0} />
          </tbody>
        </table>
      </div>

      <div className="md:hidden">
        {employees.length > 0 ? (
          <label className="flex cursor-pointer items-center gap-3 border-b border-black/10 py-3">
            <SelectAllCheckbox
              employees={employees}
              selectedIds={selectedIds}
              onToggleAll={onTogglePage}
            />
            <span className="font-montserrat text-[12px] font-medium text-[#909090]">Select all</span>
          </label>
        ) : null}
        <ul className="flex flex-col">
          {employees.map((emp) => {
            const checked = selectedIds.has(emp.id);
            return (
              <li key={emp.id} className="border-b border-black/5 last:border-b-0">
                <label
                  className={cn(
                    "flex cursor-pointer items-start gap-3 py-3",
                    checked && "bg-[#fafafa]",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) => onToggle(emp, event.target.checked)}
                    className={cn(CHECKBOX_CLASS, "mt-2 shrink-0")}
                    aria-label={`Select ${emp.name}`}
                  />
                  <div className="min-w-0 flex-1">
                    <RecipientNameCell employee={emp} />
                    <p className="mt-1 font-montserrat text-[12px] text-[#909090]">
                      {typeLabel(emp.employee_type)} · {formatCompensation(emp)} · {scheduleLabel(emp.payment_cadence)}
                    </p>
                    <div className="mt-1.5">
                      <RecipientWalletCell employee={emp} />
                    </div>
                  </div>
                </label>
              </li>
            );
          })}
          {!isLoading && employees.length === 0 ? (
            <li className="px-2 py-12 text-center font-montserrat text-[14px] text-[#909090]">
              No recipients found
            </li>
          ) : null}
          {isLoading && employees.length === 0 ? (
            <li className="px-2 py-12 text-center font-montserrat text-[14px] text-[#909090]">
              Loading…
            </li>
          ) : null}
        </ul>
      </div>
    </div>
  );
}

function SelectAllCheckbox({
  employees,
  selectedIds,
  onToggleAll,
}: {
  employees: Employee[];
  selectedIds: Set<string>;
  onToggleAll: (next: boolean) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const selectedOnPage = employees.filter((emp) => selectedIds.has(emp.id)).length;
  const allSelected = employees.length > 0 && selectedOnPage === employees.length;
  const someSelected = selectedOnPage > 0 && !allSelected;

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = someSelected;
  }, [someSelected]);

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={allSelected}
      disabled={employees.length === 0}
      onChange={(event) => onToggleAll(event.target.checked)}
      onClick={(event) => event.stopPropagation()}
      className={CHECKBOX_CLASS}
      aria-label="Select all on this page"
    />
  );
}

function EmptyRows({
  colSpan,
  isLoading,
  empty,
}: {
  colSpan: number;
  isLoading?: boolean;
  empty: boolean;
}) {
  if (!empty) return null;
  return (
    <tr>
      <td colSpan={colSpan} className="px-5 py-12 text-center font-montserrat text-[14px] text-[#909090]">
        {isLoading ? "Loading…" : "No recipients found"}
      </td>
    </tr>
  );
}
