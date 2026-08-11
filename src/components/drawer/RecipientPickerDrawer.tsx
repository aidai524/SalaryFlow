import { useMemo, useState } from "react";
import { IdentityAvatar } from "@/components/IdentityAvatar";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useEmployeesQuery } from "@/hooks/use-pay-api";
import { cn } from "@/lib/utils";
import { useDrawerStore } from "@/stores/drawer";

type FilterTab = "all" | "employee" | "contractor" | "others";

const TABS: { id: FilterTab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "employee", label: "Employees" },
  { id: "contractor", label: "Contractors" },
  { id: "others", label: "Others" },
];

export function RecipientPickerDrawer() {
  const kind = useDrawerStore((s) => s.kind);
  const payload = useDrawerStore((s) => s.recipientPicker);
  const close = useDrawerStore((s) => s.close);
  const open = kind === "recipient-picker";
  const [tab, setTab] = useState<FilterTab>(payload?.filter || "all");
  const { data: employees = [], isLoading } = useEmployeesQuery();

  const filtered = useMemo(() => {
    if (tab === "all") return employees;
    return employees.filter((e) => (e.employee_type || "employee") === tab);
  }, [employees, tab]);

  return (
    <Sheet open={open} onOpenChange={(next) => !next && close()}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="w-full max-w-[438px] gap-0 border-l-0 bg-white p-0 sm:max-w-[438px]"
      >
        <SheetHeader className="px-6 pt-9 pb-4">
          <SheetTitle className="font-montserrat text-[20px] font-semibold text-black">
            Recipient
          </SheetTitle>
        </SheetHeader>

        <div className="flex flex-wrap gap-2 px-6 pb-4">
          {TABS.map((item) => {
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={cn(
                  "h-9 rounded-[25px] px-4 font-montserrat text-[14px] font-medium transition-colors",
                  active
                    ? "bg-black text-white shadow-[0px_0px_6px_0px_rgba(0,0,0,0.06)]"
                    : "border border-black/20 text-[#606060] hover:bg-black/5",
                )}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-8">
          {isLoading && (
            <p className="px-2 py-6 font-montserrat text-[14px] text-[#606060]">Loading…</p>
          )}
          {!isLoading && filtered.length === 0 && (
            <p className="px-2 py-6 font-montserrat text-[14px] text-[#606060]">No recipients</p>
          )}
          <ul className="flex flex-col gap-1">
            {filtered.map((emp) => {
              const selected = payload?.selectedId === emp.id;
              return (
                <li key={emp.id}>
                  <button
                    type="button"
                    onClick={() => {
                      payload?.onSelect?.(emp.id);
                      close();
                    }}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-[12px] px-3 py-2.5 text-left transition-colors hover:bg-[#f6f6f6]",
                      selected && "bg-[#f6f6f6]",
                    )}
                  >
                    <IdentityAvatar seed={emp.email || emp.name} size={32} alt="" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-montserrat text-[14px] text-black">
                        {emp.name}
                      </span>
                      <span className="block truncate font-montserrat text-[10px] text-[#606060]">
                        {emp.role_title || "—"}
                      </span>
                    </span>
                    <img
                      src="/icons/to-down.svg"
                      alt=""
                      className="size-2.5 shrink-0 -rotate-90 opacity-40"
                    />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </SheetContent>
    </Sheet>
  );
}
