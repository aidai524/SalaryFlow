import { useState } from "react";
import { BatchPayoutDialog } from "./BatchPayoutDialog";
import { usePaymentWallet } from "@/hooks/use-payment-wallet";

export function BatchPayoutButton({ initialEmployeeIds }: { initialEmployeeIds?: string[] }) {
  const [open, setOpen] = useState(false);
  const payWallet = usePaymentWallet();

  async function handleClick() {
    const ready = await payWallet.ensureWalletReady();
    if (!ready) return;
    setOpen(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => void handleClick()}
        className="inline-flex h-8 items-center rounded-[16px] border border-black/10 px-3 font-montserrat text-[12px] font-medium text-black transition-colors hover:bg-black/5"
      >
        Batch payout
      </button>
      <BatchPayoutDialog
        open={open}
        onOpenChange={setOpen}
        initialEmployeeIds={initialEmployeeIds}
      />
    </>
  );
}
