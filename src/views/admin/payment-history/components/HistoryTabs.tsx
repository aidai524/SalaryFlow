import { cn } from "@/lib/utils";

export function HistoryTabs({
  value,
  onChange,
}: {
  value: "payments" | "batches";
  onChange: (value: "payments" | "batches") => void;
}) {
  const tabs: Array<{ id: "payments" | "batches"; label: string }> = [
    { id: "payments", label: "Payments" },
    { id: "batches", label: "Batches" },
  ];
  return (
    <div className="mb-4 inline-flex rounded-[20px] bg-white p-1">
      {tabs.map((tab) => {
        const active = value === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={cn(
              "h-8 rounded-[16px] px-4 font-montserrat text-[13px] font-medium",
              active ? "bg-black text-white" : "text-[#606060] hover:bg-black/5",
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
