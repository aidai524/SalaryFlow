import type { ReactNode } from "react";

export function StatCell({
  label,
  value,
  trailing,
  subtitle,
}: {
  label: string;
  value: string;
  trailing?: ReactNode;
  subtitle?: ReactNode;
}) {
  return (
    <div className="min-w-0 flex-1 px-4 py-4 first:pl-5 last:pr-5 sm:px-6">
      <p className="font-montserrat text-[14px] font-medium capitalize text-[#606060]">{label}</p>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <p className="font-montserrat text-[20px] font-semibold capitalize text-black">{value}</p>
        {trailing}
      </div>
      {subtitle ? (
        <div className="mt-1 font-montserrat text-[12px] text-[#909090]">{subtitle}</div>
      ) : null}
    </div>
  );
}
