import { parsePositiveDecimal } from "@/lib/amount-input";
import type { BatchDraft } from "../utils";

export function EditAmountsStep({
  drafts,
  onChange,
}: {
  drafts: BatchDraft[];
  onChange: (employeeId: string, patch: Partial<Pick<BatchDraft, "amount" | "memo">>) => void;
}) {
  return (
    <div>
      <table className="hidden w-full border-collapse text-left md:table">
        <thead>
          <tr className="border-b border-black/10">
            {["Name", "Amount", "Memo"].map((label) => (
              <th
                key={label}
                className="px-2 py-3 font-montserrat text-[12px] font-medium text-[#909090] first:pl-3 last:pr-3"
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {drafts.map((row) => (
            <AmountRow key={row.employee.id} row={row} onChange={onChange} table />
          ))}
        </tbody>
      </table>

      <ul className="flex flex-col gap-4 md:hidden">
        {drafts.map((row) => (
          <li key={row.employee.id} className="border-b border-black/5 pb-4 last:border-b-0 last:pb-0">
            <AmountRow row={row} onChange={onChange} table={false} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function AmountRow({
  row,
  onChange,
  table,
}: {
  row: BatchDraft;
  onChange: (employeeId: string, patch: Partial<Pick<BatchDraft, "amount" | "memo">>) => void;
  table: boolean;
}) {
  const valid = row.amount.trim() === "" || !!parsePositiveDecimal(row.amount);
  const showError = row.amount.trim() !== "" && !valid;
  const name = (
    <>
      <p className="font-montserrat text-[14px] font-medium text-black">{row.employee.name}</p>
      <p className="font-montserrat text-[12px] text-[#909090]">
        {row.employee.token} · {row.employee.network}
      </p>
    </>
  );
  const amountInput = (
    <>
      <input
        value={row.amount}
        onChange={(event) => onChange(row.employee.id, { amount: event.target.value })}
        placeholder="0.00"
        className="h-9 w-full rounded-[6px] border border-[#e3e3e3] bg-[#f6f6f6] px-3 font-montserrat text-[14px] outline-none focus:border-black/30 md:max-w-[140px]"
      />
      {showError ? (
        <p className="mt-1 font-montserrat text-[11px] text-red-600">Amount must be greater than 0</p>
      ) : null}
    </>
  );
  const memoInput = (
    <input
      value={row.memo}
      onChange={(event) => onChange(row.employee.id, { memo: event.target.value })}
      maxLength={200}
      placeholder="Optional"
      className="h-9 w-full rounded-[6px] border border-[#e3e3e3] bg-[#f6f6f6] px-3 font-montserrat text-[14px] outline-none placeholder:text-black/30 focus:border-black/30"
    />
  );

  if (table) {
    return (
      <tr className="border-b border-black/5 last:border-b-0">
        <td className="px-2 py-3 first:pl-3">{name}</td>
        <td className="px-2 py-3">{amountInput}</td>
        <td className="px-2 py-3 last:pr-3">{memoInput}</td>
      </tr>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div>{name}</div>
      <label className="flex flex-col gap-1">
        <span className="font-montserrat text-[12px] text-[#909090]">Amount</span>
        {amountInput}
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-montserrat text-[12px] text-[#909090]">Memo</span>
        {memoInput}
      </label>
    </div>
  );
}
