import { useEffect, useRef, useState } from "react";
import Pagination from "@/components/pagination";
import { SearchInput } from "@/components/search-input/SearchInput";
import { useRecipientsQuery } from "@/hooks/use-recipients-api";
import type { Employee } from "@/lib/api";
import { BatchEmployeeSelectTable } from "../components/BatchEmployeeSelectTable";
import { BATCH_PAYOUT_PAGE_SIZE, SEARCH_DEBOUNCE_MS } from "../config";

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

export function SelectEmployeesStep({
  page,
  onPageChange,
  selected,
  onToggle,
  onTogglePage,
}: {
  page: number;
  onPageChange: (page: number) => void;
  selected: Map<string, Employee>;
  onToggle: (employee: Employee, next: boolean) => void;
  onTogglePage: (employees: Employee[], next: boolean) => void;
}) {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);
  const skipSearchPageReset = useRef(true);

  useEffect(() => {
    if (skipSearchPageReset.current) {
      skipSearchPageReset.current = false;
      return;
    }
    onPageChange(1);
  }, [debouncedSearch, onPageChange]);

  // `q` searches employees only. A pasted 0x string is treated as a search term,
  // not an ad-hoc pay-to-address (Quick Pay). A future "pay to address" batch
  // path can hook empty results here without changing quote/commit employee rows.
  const query = useRecipientsQuery({
    page,
    pageSize: BATCH_PAYOUT_PAGE_SIZE,
    q: debouncedSearch.trim() || undefined,
  });
  const employees = query.data?.employees || [];
  const total = query.data?.total || 0;
  const totalPage = Math.max(1, Math.ceil(total / BATCH_PAYOUT_PAGE_SIZE));

  return (
    <div>
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-montserrat text-[13px] text-[#606060]">
          {selected.size} selected
        </p>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search name"
          className="w-full sm:max-w-[240px]"
          aria-label="Search recipients"
        />
      </div>
      <BatchEmployeeSelectTable
        employees={employees}
        selectedIds={new Set(selected.keys())}
        onToggle={onToggle}
        onTogglePage={(next) => onTogglePage(employees, next)}
        isLoading={query.isLoading}
      />
      {totalPage > 1 ? (
        <div className="flex justify-end py-3">
          <Pagination
            page={page}
            pageSize={BATCH_PAYOUT_PAGE_SIZE}
            totalPage={totalPage}
            onPageChange={onPageChange}
          />
        </div>
      ) : null}
    </div>
  );
}
