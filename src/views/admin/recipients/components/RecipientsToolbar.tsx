import {
  PaymentPeriodPicker,
  type PaymentPeriodPickerProps,
} from "@/components/payment-period-picker/PaymentPeriodPicker";
import { SearchInput } from "@/components/search-input/SearchInput";
import type { TeamPaymentSchedule } from "@/lib/api";
import { cn } from "@/lib/utils";
import { TYPE_FILTERS, type TypeFilter } from "../config";

export interface RecipientsToolbarProps {
  cadence: TeamPaymentSchedule;
  periodKey: string;
  onPeriodChange: (periodKey: string) => void;
  typeFilter: TypeFilter;
  onTypeFilterChange: (filter: TypeFilter) => void;
  counts: { all: number; employees: number; contractors: number; others: number };
  search: string;
  onSearchChange: (value: string) => void;
  className?: string;
}

export function RecipientsToolbar({
  cadence,
  periodKey,
  onPeriodChange,
  typeFilter,
  onTypeFilterChange,
  counts,
  search,
  onSearchChange,
  className,
}: RecipientsToolbarProps) {
  const countFor = (value: TypeFilter) => {
    if (value === "employee") return counts.employees;
    if (value === "contractor") return counts.contractors;
    if (value === "others") return counts.others;
    return counts.all;
  };

  const periodPickerProps: PaymentPeriodPickerProps = {
    cadence,
    value: periodKey,
    onChange: onPeriodChange,
  };

  return (
    <div
      className={cn(
        "flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between",
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        <PaymentPeriodPicker {...periodPickerProps} />
        <div className="flex flex-wrap items-center gap-1.5">
          {TYPE_FILTERS.map((item) => {
            const active = typeFilter === item.value;
            return (
              <button
                key={item.value}
                type="button"
                onClick={() => onTypeFilterChange(item.value)}
                className={cn(
                  "inline-flex h-9 items-center rounded-[18px] px-3.5 border font-montserrat text-[13px] font-medium transition-colors",
                  active
                    ? "bg-black border-black text-white"
                    : "bg-transparent border-[rgba(0,0,0,0.2)] text-[#606060] hover:bg-black/5",
                )}
              >
                {item.label} ({countFor(item.value)})
              </button>
            );
          })}
        </div>
      </div>

      <SearchInput
        value={search}
        onChange={onSearchChange}
        placeholder="Search"
        className="max-w-[280px] shrink-0"
        inputClassName="h-10 rounded-[20px] border-black/10 pl-10 placeholder:text-[#aaa]"
      />
    </div>
  );
}
