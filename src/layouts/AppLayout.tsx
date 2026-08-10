import { Outlet } from "react-router-dom";
import { AppHeader } from "@/components/layout/AppHeader";

export function AppLayout() {
  return (
    <div className="min-h-svh bg-[#f6f6f6] text-black">
      <AppHeader />
      <main className="mx-auto w-full max-w-[1512px] px-4 pb-8 sm:px-6 md:px-10 lg:px-[50px]">
        <Outlet />
      </main>
    </div>
  );
}
