import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { IconLink, IconPay, IconPen, IconRemove } from "@/components/icons";
import { cn } from "@/lib/utils";

export interface RecipientRowMenuProps {
  onEdit: () => void;
  onInviteToVerify: () => void;
  onPayNow: () => void;
  onRemove: () => void;
  /** When false, hide "Invites to verify" (e.g. already verified). */
  canInviteToVerify?: boolean;
  className?: string;
}

export function RecipientRowMenu({
  onEdit,
  onInviteToVerify,
  onPayNow,
  onRemove,
  canInviteToVerify = true,
  className,
}: RecipientRowMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Open recipient actions"
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "inline-flex size-8 items-center justify-center rounded-full transition-colors hover:bg-black/5",
            className,
          )}
        >
          <img src="/icons/menu.svg" alt="" className="size-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="min-w-[180px] rounded-[12px] border border-black/10 bg-white p-1 shadow-[0px_8px_24px_rgba(0,0,0,0.08)]"
        onClick={(e) => e.stopPropagation()}
      >
        <DropdownMenuItem
          className="cursor-pointer gap-2 rounded-[8px] px-3 py-2 font-montserrat text-[13px] text-black focus:bg-black/5"
          onSelect={onEdit}
        >
          <IconPen className="size-3.5 text-[#AAA]" />
          Edit
        </DropdownMenuItem>
        {canInviteToVerify ? (
          <DropdownMenuItem
            className="cursor-pointer gap-2 rounded-[8px] px-3 py-2 font-montserrat text-[13px] text-black focus:bg-black/5"
            onSelect={onInviteToVerify}
          >
            <IconLink className="size-3.5 text-[#AAA]" />
            Invites to verify
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem
          className="cursor-pointer gap-2 rounded-[8px] px-3 py-2 font-montserrat text-[13px] text-black focus:bg-black/5"
          onSelect={onPayNow}
        >
          <IconPay className="size-3.5 text-[#AAA]" />
          Pay Now
        </DropdownMenuItem>
        <DropdownMenuItem
          variant="destructive"
          className="cursor-pointer gap-2 rounded-[8px] px-3 py-2 font-montserrat text-[13px] focus:bg-red-50"
          onSelect={onRemove}
        >
          <IconRemove className="size-3.5 text-[#AAA]" />
          Remove
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
