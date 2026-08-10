import { Outlet, useLocation } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import { GlobalDrawerHost } from "@/components/drawer/GlobalDrawerHost";
import { AppHeader } from "@/components/layout/AppHeader";
import { CREATE_TEAM_BG } from "@/views/admin/create-team/config";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth";

export function AppLayout() {
  const location = useLocation();
  const isCreateTeam = location.pathname === "/teams/create";
  const role = useAuthStore((s) => s.user?.role);

  return (
    <div
      className={cn("min-h-svh text-black", !isCreateTeam && "bg-[#f6f6f6]")}
      style={isCreateTeam ? { backgroundColor: CREATE_TEAM_BG } : undefined}
    >
      <AppHeader variant={isCreateTeam ? "onboarding" : "default"} />
      <main
        className={cn(
          "mx-auto w-full",
          isCreateTeam
            ? "max-w-none px-0 pb-0"
            : "max-w-[1512px] px-4 pb-8 sm:px-6 md:px-10 lg:px-[50px]",
        )}
      >
        <Outlet />
      </main>
      {role === "admin" ? <GlobalDrawerHost /> : null}
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
