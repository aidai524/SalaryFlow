import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrencyFromMinor, formatNumber } from "@/lib/format";
import type { OrgOverview } from "@/lib/api";

type BarItem = OrgOverview["volume"]["bars"][number];

function formatAxisTick(minor: number): string {
  const value = Number(minor) / 1_000_000;
  if (value >= 1000) return `$${formatNumber(value / 1000, { maximumFractionDigits: 0 })}K`;
  return `$${formatNumber(value, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatBarAmount(minor: number): string {
  const value = Number(minor) / 1_000_000;
  if (value >= 1000) return `$${formatNumber(value / 1000, { maximumFractionDigits: 1 })}K`;
  if (value >= 100) return `$${formatNumber(value, { maximumFractionDigits: 0 })}`;
  return formatCurrencyFromMinor(minor);
}

function ChangeBadge({ changePct }: { changePct: number | null }) {
  if (changePct === null) return null;
  const positive = changePct >= 0;
  return (
    <span
      className={`inline-flex rounded-[8px] px-1.5 py-0.5 font-montserrat text-[10px] font-medium ${
        positive ? "bg-[#0ed000]/15 text-[#0ed000]" : "bg-[#ff4d4f]/15 text-[#ff4d4f]"
      }`}
    >
      {positive ? "+" : ""}
      {changePct}%
    </span>
  );
}

function BarTopLabel(props: {
  x?: number | string;
  y?: number | string;
  width?: number | string;
  value?: number | string;
  index?: number;
  bars?: BarItem[];
}) {
  const { x = 0, y = 0, width = 0, value = 0, index = 0, bars = [] } = props;
  const bar = bars[index];
  const nx = Number(x);
  const ny = Number(y);
  const nw = Number(width);
  return (
    <g transform={`translate(${nx + nw / 2}, ${ny - 8})`}>
      <foreignObject x={-40} y={-28} width={80} height={36}>
        <div className="flex flex-col items-center gap-0.5">
          <span className="font-montserrat text-[11px] font-medium text-black">
            {formatBarAmount(Number(value))}
          </span>
          <ChangeBadge changePct={bar?.changePct ?? null} />
        </div>
      </foreignObject>
    </g>
  );
}

export function VolumeBarChart({ bars }: { bars: BarItem[] }) {
  const data = bars.map((b) => ({
    ...b,
    amount: b.amountMinor,
  }));

  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 36, right: 8, left: 0, bottom: 0 }} barCategoryGap="28%">
          <CartesianGrid vertical={false} stroke="#ebebeb" strokeDasharray="0" />
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#909090", fontSize: 12, fontFamily: "Montserrat" }}
          />
          <YAxis
            tickFormatter={formatAxisTick}
            axisLine={false}
            tickLine={false}
            width={48}
            tick={{ fill: "#909090", fontSize: 11, fontFamily: "Montserrat" }}
          />
          <Tooltip
            cursor={{ fill: "rgba(0,0,0,0.04)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const item = payload[0].payload as BarItem & { amount: number };
              return (
                <div className="rounded-[10px] border border-black/10 bg-white px-3 py-2 shadow-sm">
                  <p className="font-montserrat text-[12px] text-[#606060]">{item.label}</p>
                  <p className="font-montserrat text-[13px] font-medium text-black">
                    {formatCurrencyFromMinor(item.amountMinor)}
                  </p>
                </div>
              );
            }}
          />
          <Bar dataKey="amount" radius={[6, 6, 0, 0]} maxBarSize={48}>
            {data.map((entry) => (
              <Cell key={entry.periodKey} fill={entry.isCurrent ? "#000000" : "#e8e8e8"} />
            ))}
            <LabelList dataKey="amount" content={<BarTopLabel bars={bars} />} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
