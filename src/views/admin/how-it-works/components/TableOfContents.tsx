import { cn } from "@/lib/utils";

export const TOC_ITEMS = [
  {
    id: "how-confidential-payments-work",
    label: "How Confidential Payments Work",
  },
  {
    id: "the-problem-with-normal-on-chain-payments",
    label: "The Problem With Normal On-Chain Payments",
  },
  {
    id: "how-confidential-payments-work-on-decash",
    label: "How Confidential Payments Work",
  },
  {
    id: "why-confidential-intents",
    label: "Why Confidential Intents",
  },
  {
    id: "built-for-more-than-payroll",
    label: "Built for More Than Payroll",
  },
  {
    id: "what-confidential-does-and-doesnt-mean",
    label: "What Confidential Does — and Doesn't — Mean",
  },
] as const;

export type TocId = (typeof TOC_ITEMS)[number]["id"];

type TableOfContentsProps = {
  activeId: TocId;
  onNavigate: (id: TocId) => void;
};

export function TableOfContents({ activeId, onNavigate }: TableOfContentsProps) {
  return (
    <nav aria-label="Page sections" className="flex flex-col gap-1">
      {TOC_ITEMS.map((item) => {
        const active = item.id === activeId;
        return (
          <a
            key={item.id}
            href={`#${item.id}`}
            onClick={(e) => {
              e.preventDefault();
              onNavigate(item.id);
            }}
            className={cn(
              "rounded-[6px] px-3 py-2.5 font-montserrat text-[14px] leading-snug transition-colors",
              active
                ? "bg-[#ebebeb] font-medium text-black"
                : "font-normal text-[#606060] hover:text-black",
            )}
          >
            <span className="line-clamp-1">{item.label}</span>
          </a>
        );
      })}
    </nav>
  );
}
