import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useDeleteEmployeeMutation } from "@/hooks/use-recipients-api";
import useToast from "@/hooks/use-toast";
import type { Employee } from "@/lib/api";

export interface RemoveRecipientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: Employee | null;
  onRemoved?: (id: string) => void;
}

export function RemoveRecipientDialog({
  open,
  onOpenChange,
  employee,
  onRemoved,
}: RemoveRecipientDialogProps) {
  const toast = useToast();
  const mutation = useDeleteEmployeeMutation();

  const confirm = async () => {
    if (!employee) return;
    try {
      await mutation.mutateAsync(employee.id);
      toast.success({ title: `${employee.name} removed from team` });
      onRemoved?.(employee.id);
      onOpenChange(false);
    } catch (cause) {
      toast.fail({
        title: cause instanceof Error ? cause.message : "Failed to remove recipient",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className="max-w-[400px] gap-0 rounded-[24px] p-0 sm:max-w-[400px]"
      >
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="font-montserrat text-[18px] font-semibold text-black">
            Remove recipient?
          </DialogTitle>
          <DialogDescription className="font-montserrat text-[13px] text-[#606060]">
            {employee
              ? `${employee.name} will be removed from this team. This cannot be undone from this page.`
              : "This recipient will be removed from the team."}
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-3 px-6 py-5">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="inline-flex h-11 flex-1 items-center justify-center rounded-[22px] border border-black/15 bg-white font-montserrat text-[14px] font-medium text-black transition-colors hover:bg-black/5"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={mutation.isPending || !employee}
            onClick={() => void confirm()}
            className="inline-flex h-11 flex-1 items-center justify-center rounded-[22px] bg-[#e11d48] font-montserrat text-[14px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {mutation.isPending ? "Removing…" : "Remove"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
