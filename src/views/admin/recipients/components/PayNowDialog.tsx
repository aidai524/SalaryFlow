import { IconClose } from "@/components/icons/close";
import { QuickPayPanel } from "@/components/quick-pay/QuickPayPanel";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface PayNowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string | null;
}

export function PayNowDialog({
  open,
  onOpenChange,
  employeeId,
}: PayNowDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-h-[90vh] max-w-[560px] gap-0 overflow-y-auto rounded-[24px] border-none bg-transparent p-0 shadow-none ring-0 sm:max-w-[560px]"
      >
        <div className="rounded-[24px] bg-[#fdfdfd] shadow-[0px_0px_20px_0px_rgba(0,0,0,0.06)]">
          <DialogHeader className="flex flex-row items-center justify-between space-y-0 px-5 pt-5 pb-2">
            <DialogTitle className="font-montserrat text-[18px] font-semibold text-black">
              Pay Now
            </DialogTitle>
            <button
              type="button"
              aria-label="Close"
              onClick={() => onOpenChange(false)}
              className="inline-flex size-8 items-center justify-center rounded-full transition-colors hover:bg-black/5"
            >
              <IconClose className="size-4" />
            </button>
          </DialogHeader>
          <div className="px-3 pb-4 sm:px-4">
            {employeeId ? (
              <QuickPayPanel
                initialEmployeeId={employeeId}
                hideTitle
                recipientLocked
                compensationLayout="centered"
                destinationTokenLocked
                className="border-0 bg-transparent p-0 shadow-none"
              />
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
