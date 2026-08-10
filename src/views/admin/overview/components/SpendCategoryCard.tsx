import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import type { OrgOverview } from "@/lib/api";
import { CARD_CLASS, CATEGORY_COLORS } from "../config";

export function SpendCategoryCard({
  category,
  isLoading,
}: {
  category: OrgOverview["category"] | undefined;
  isLoading: boolean;
}) {
  const data = (category || []).map((c) => ({
    name: c.label,
    value: c.count,
    pct: c.pct,
    type: c.type,
  }));

  return (
    <section className={`${CARD_CLASS} p-5 sm:p-6`}>
      <h2 className="mb-4 font-montserrat text-[20px] font-medium text-black">Spend On Category</h2>
      {isLoading ? (
        <div className="flex h-[220px] items-center justify-center font-montserrat text-[14px] text-[#909090]">
          Loading…
        </div>
      ) : data.length === 0 ? (
        <div className="flex h-[220px] items-center justify-center font-montserrat text-[14px] text-[#909090]">
          No recipients yet
        </div>
      ) : (
        <>
          <div className="mx-auto h-[180px] w-full max-w-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  innerRadius="62%"
                  outerRadius="88%"
                  stroke="none"
                  paddingAngle={1}
                >
                  {data.map((entry) => (
                    <Cell key={entry.type} fill={CATEGORY_COLORS[entry.type]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            {data.map((item) => (
              <li key={item.type} className="inline-flex items-center gap-2">
                <span
                  className="size-2.5 rounded-[2px]"
                  style={{ backgroundColor: CATEGORY_COLORS[item.type] }}
                />
                <span className="font-montserrat text-[13px] text-black">
                  {item.name} ({item.pct}%)
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
