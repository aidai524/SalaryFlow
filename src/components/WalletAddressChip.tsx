import { useState } from "react";
import { EmployeePayoutWalletDialog } from "@/components/EmployeePayoutWalletDialog";
import { IdentityAvatar } from "@/components/IdentityAvatar";
import { WalletConnectDialog } from "@/components/WalletConnect";
import { formatAddress } from "@/lib/address";
import type { AuthUser } from "@/lib/api";
import { cn } from "@/lib/utils";

export function WalletAddressChip({
  user,
  onUserChange,
  className,
}: {
  user: AuthUser;
  onUserChange: (user: AuthUser) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const bound = Boolean(user.wallet_address && user.wallet_verified);
  const label = bound ? formatAddress(user.wallet_address) : "Connect wallet";
  const seed = user.wallet_address || user.email;
  const isEmployee = user.role === "employee";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex h-9 max-w-48 items-center gap-2 rounded-full border border-border bg-background px-1.5 pr-3 text-left transition-colors hover:bg-muted/60",
          className,
        )}
        aria-label={bound ? `Wallet ${label}` : "Connect wallet"}
      >
        <IdentityAvatar seed={seed} size={30} alt="" />
        <span className="truncate text-sm text-foreground">{label}</span>
      </button>
      {open && isEmployee && (
        <EmployeePayoutWalletDialog
          onClose={() => setOpen(false)}
          onBound={(address) => {
            setOpen(false);
            onUserChange({ ...user, wallet_address: address, wallet_verified: true });
          }}
        />
      )}
      {open && !isEmployee && (
        <WalletConnectDialog
          user={user}
          onClose={() => setOpen(false)}
          onBound={(address) => {
            setOpen(false);
            onUserChange({ ...user, wallet_address: address, wallet_verified: true });
          }}
          onUnbound={() => {
            onUserChange({ ...user, wallet_address: null, wallet_verified: false });
          }}
        />
      )}
    </>
  );
}
