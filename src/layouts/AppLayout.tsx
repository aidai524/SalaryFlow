import { Outlet } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import { GlobalDrawerHost } from "@/components/drawer/GlobalDrawerHost";
import { AppHeader } from "@/components/layout/AppHeader";
import { PendingPaymentsDock } from "@/components/pending-payments/PendingPaymentsDock";
import { useBatchPayoutCommitQueue } from "@/hooks/use-batch-payout-commit-queue";
import { useQuickPayCommitQueue } from "@/hooks/use-quick-pay-commit-queue";
import { useAuthStore } from "@/stores/auth";

function AdminQuickPayCommitFlush() {
  useQuickPayCommitQueue();
  useBatchPayoutCommitQueue();
  return null;
}

export function AppLayout() {
  const role = useAuthStore((s) => s.user?.role);

  return (
    <div className="min-h-svh bg-[#f6f6f6] text-black">
      <AppHeader variant="default" />
      <main className="mx-auto w-full max-w-[1512px] px-4 pb-8 sm:px-6 md:px-10 lg:px-[50px]">
        <Outlet />
      </main>
      {role === "admin" ? <GlobalDrawerHost /> : null}
      {role === "admin" ? <AdminQuickPayCommitFlush /> : null}
      {role === "admin" ? <PendingPaymentsDock /> : null}
      <ToastContainer
        position="top-right"
        autoClose={5000}
        hideProgressBar
        theme="light"
        toastStyle={{ backgroundColor: "transparent", boxShadow: "none" }}
        newestOnTop
        rtl={false}
        pauseOnFocusLoss
        closeButton={false}
      />
    </div>
  );
}
