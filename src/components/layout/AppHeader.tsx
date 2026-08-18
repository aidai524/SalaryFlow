import { KeyRound, LogOut } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { EmployeePayoutWalletDialog } from "@/components/EmployeePayoutWalletDialog";
import { IdentityAvatar, identityAvatarSeed } from "@/components/IdentityAvatar";
import { WalletConnectDialog } from "@/components/WalletConnect";
import { IconAlert } from "@/components/icons/alert";
import { IconCheck } from "@/components/icons/check";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { chainKindForNetwork } from "@/config/chains";
import { myPayoutQueryKey, useMyPayoutQuery } from "@/hooks/use-employee-api";
import { formatAddress } from "@/lib/address";
import { sameAddress } from "@/lib/address-validation";
import { bindingForKind } from "@/lib/admin-wallets";
import type { MyPayout } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth";
import { ChangePasswordDialog } from "@/views/auth/ChangePasswordDialog";
import { isVerified } from "@/views/admin/recipients/utils";
import { useWallet, type ChainKind } from "@/wallet";

const ADMIN_NAV = [
  { to: "/pay", label: "Pay" },
  { to: "/recipients", label: "Recipients" },
  { to: "/overview", label: "Overview" },
] as const;

const EMPLOYEE_NAV = [
  { to: "/my-pay", label: "My Pay" },
] as const;

function walletKindFromNetwork(network: string | null | undefined): ChainKind {
  const kind = chainKindForNetwork(network || "");
  return kind === "near" || kind === "solana" ? kind : "evm";
}

function HeaderWalletChip() {
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const isAdmin = user?.role === "admin";
  const payoutQuery = useMyPayoutQuery();
  const payout = payoutQuery.data?.payout;
  const activeKind = (user?.wallet_chain_kind || "evm") as ChainKind;
  const employeeKind = walletKindFromNetwork(payout?.network);
  const wallet = useWallet(isAdmin ? activeKind : employeeKind);

  if (!user) return null;

  // Show bound address even when ownership is not verified.
  // Employees store the receive address on payout.endpoint; admins on the active chain wallet.
  const displayAddress = isAdmin
    ? (bindingForKind(user, activeKind)?.address || null)
    : (payout?.endpoint || user.wallet_address || null);
  const bound = Boolean(displayAddress);
  const label = bound ? formatAddress(displayAddress) : "Connect";
  const seed = isAdmin ? identityAvatarSeed(user) : identityAvatarSeed(payout ?? user);
  const avatarSrc = isAdmin ? undefined : (payout?.avatar_url || null);
  const verified = Boolean(payout && isVerified(payout));
  const connected = Boolean(
    !isAdmin
    && displayAddress
    && wallet.account?.address
    && sameAddress(wallet.account.address, displayAddress, employeeKind),
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-[42px] items-center gap-[7px] rounded-[25px] border border-black/20 bg-white py-1 pr-3.5 pl-1.5 shadow-[0_0_6px_rgba(0,0,0,0.06)]"
        aria-label={bound ? `Wallet ${label}` : "Connect wallet"}
      >
        <IdentityAvatar seed={seed} src={avatarSrc} size={30} alt="" />
        <span
          className={cn(
            "hidden font-[family-name:var(--font-space-grotesk)] text-sm sm:inline",
            !isAdmin && bound && !connected ? "text-[#909090]" : "text-black",
          )}
        >
          {label}
        </span>
        {!isAdmin && bound ? (
          verified ? (
            <span
              className="hidden size-3 shrink-0 items-center justify-center rounded-full bg-[#0ED000] sm:inline-flex"
              title="Verified"
            >
              <IconCheck className="size-1.5 text-white" />
            </span>
          ) : (
            <span
              className="hidden size-3 shrink-0 items-center justify-center rounded-full bg-[#AAA] sm:inline-flex"
              title="Unverified"
            >
              <IconAlert className="size-1.5 text-white" />
            </span>
          )
        ) : null}
      </button>

      {open && !isAdmin && (
        <EmployeePayoutWalletDialog
          onClose={() => setOpen(false)}
          onBound={(next: MyPayout) => {
            setOpen(false);
            const current = useAuthStore.getState().user;
            if (current) {
              setUser({
                ...current,
                wallet_address: next.endpoint,
                wallet_chain_kind: walletKindFromNetwork(next.network),
                wallet_verified: true,
              });
            }
            queryClient.setQueryData(myPayoutQueryKey(current?.org_id ?? user.org_id), { payout: next });
          }}
        />
      )}
      {open && isAdmin && (
        <WalletConnectDialog
          user={user}
          onClose={() => setOpen(false)}
          onBound={(update) => {
            const current = useAuthStore.getState().user;
            if (current) setUser({ ...current, ...update });
          }}
          onUnbound={(update) => {
            const current = useAuthStore.getState().user;
            if (current) setUser({ ...current, ...update });
          }}
        />
      )}
    </>
  );
}

function HeaderAccountMenu({
  onChangePassword,
}: {
  onChangePassword: () => void;
}) {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  if (!user) return null;

  const handleSignOut = () => {
    void logout().then(() => {
      navigate("/login", { replace: true });
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-grid size-[42px] place-items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-black/20"
          aria-label="Open account menu"
          title="Account menu"
        >
          <img src="/icons/menu.svg" alt="" width={16} height={16} className="size-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className={cn(
          "min-w-56 rounded-2xl border border-black/10 bg-white p-2",
          "font-[family-name:var(--font-montserrat)] text-black",
          "shadow-[0_0_20px_rgba(0,0,0,0.06)] ring-0",
        )}
      >
        <DropdownMenuLabel className="flex flex-col gap-0.5 px-2.5 py-2">
          <span className="truncate text-sm font-medium text-black">{user.name}</span>
          <span className="truncate text-xs font-normal text-[#606060]">{user.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="mx-1 bg-black/10" />
        <DropdownMenuItem
          onSelect={onChangePassword}
          className="cursor-pointer rounded-xl px-2.5 py-2 text-sm focus:bg-black/5"
        >
          <KeyRound className="size-4" />
          Change password
        </DropdownMenuItem>
        <DropdownMenuItem
          variant="destructive"
          onSelect={handleSignOut}
          className="cursor-pointer rounded-xl px-2.5 py-2 text-sm focus:bg-black/5"
        >
          <LogOut className="size-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppHeader({
  variant = "default",
}: {
  /** Onboarding chrome: wallet + menu only (Create Team). */
  variant?: "default" | "onboarding";
}) {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const paymentConfigured = useAuthStore((state) => state.paymentConfigured);
  const isAdmin = user?.role === "admin";
  const navItems = isAdmin ? ADMIN_NAV : EMPLOYEE_NAV;
  const homePath = isAdmin ? (paymentConfigured ? "/pay" : "/teams/create") : "/my-pay";
  const isOnboarding = variant === "onboarding";
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);

  return (
    <header
      className={cn(
        "grid w-full items-start gap-x-3 gap-y-3 px-4 py-4 sm:px-6",
        isOnboarding
          ? "grid-cols-[1fr_auto] md:items-center md:px-10 md:py-5 lg:px-14"
          : "grid-cols-[1fr_auto] md:grid-cols-[1fr_auto_1fr] md:items-center md:px-10 md:py-5 lg:px-14",
      )}
    >
      {!isOnboarding && (
        <button
          type="button"
          className="justify-self-start h-[30px] w-[96px] flex justify-center items-center"
          onClick={() => navigate(homePath)}
          aria-label="Stableflow Pay home"
        >
          <img
            src="/logo.svg"
            alt="Stableflow Pay"
            className="shrink-0 w-full h-full object-center object-contain"
          />
        </button>
      )}

      <div
        className={cn(
          "flex items-center justify-self-end gap-2",
          isOnboarding ? "col-start-2 row-start-1" : "col-start-2 row-start-1 md:col-start-3",
        )}
      >
        <HeaderWalletChip />
        <HeaderAccountMenu onChangePassword={() => setChangePasswordOpen(true)} />
      </div>

      {!isOnboarding && (
        <nav
          className={cn(
            "col-span-2 row-start-2 flex h-[42px] items-center justify-center justify-self-center gap-1.5 rounded-[25px] bg-white px-1 shadow-[0_0_6px_rgba(0,0,0,0.06)]",
            "md:col-span-1 md:col-start-2 md:row-start-1 md:gap-[15px] md:px-0",
          )}
          aria-label="Primary navigation"
        >
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "inline-flex h-[42px] min-w-0 items-center justify-center rounded-[25px] px-[17px] font-[family-name:var(--font-montserrat)] text-sm font-medium text-black md:min-w-[108px] md:px-6 md:text-base",
                  isActive && "bg-black text-white shadow-[0_0_6px_rgba(0,0,0,0.06)]",
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      )}

      <ChangePasswordDialog
        open={changePasswordOpen}
        onOpenChange={setChangePasswordOpen}
      />
    </header>
  );
}
