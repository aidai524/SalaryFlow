import { Outlet, useLocation } from "react-router-dom";
import { AppHeader } from "@/components/layout/AppHeader";
import { CREATE_TEAM_BG } from "@/views/admin/create-team/config";
import { cn } from "@/lib/utils";

export function AppLayout() {
  const location = useLocation();
  const isCreateTeam = location.pathname === "/teams/create";

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
    </div>
  );
}
