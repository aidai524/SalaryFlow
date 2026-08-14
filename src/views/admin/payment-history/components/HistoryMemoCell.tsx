import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function HistoryMemoCell({
  memo,
  className,
}: {
  memo: string | null | undefined;
  className?: string;
}) {
  const memoText = memo?.trim();
  if (!memoText) {
    return (
      <span className={cn("font-montserrat text-[14px] text-[#909090]", className)}>—</span>
    );
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <p className={cn("truncate font-montserrat text-[14px] text-black", className)}>
          {memoText}
        </p>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[280px]">
        Memo: {memoText}
      </TooltipContent>
    </Tooltip>
  );
}
