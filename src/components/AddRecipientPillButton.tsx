import { cn } from "@/lib/utils";

export interface AddRecipientPillButtonProps {
  onClick: () => void;
  className?: string;
}

/** Figma 117:16475 — dashed capsule with plus + "Add Recipient". */
export function AddRecipientPillButton({ onClick, className }: AddRecipientPillButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-10 w-[153px] items-center justify-center gap-2 rounded-[20px] border border-dashed border-black/20 bg-transparent px-3 font-montserrat text-[14px] font-medium text-black shadow-[0px_0px_6px_0px_rgba(0,0,0,0.06)] transition-colors hover:bg-black/5",
        className,
      )}
    >
      <img src="/icons/plus.svg" alt="" className="size-[12.5px]" />
      Add Recipient
    </button>
  );
}
