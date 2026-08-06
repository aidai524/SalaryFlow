import type { CSSProperties, ReactNode } from "react";
import {
  Activity,
  Bell,
  ChevronsUpDown,
  CircleDollarSign,
  FileText,
  LayoutDashboard,
  LogOut,
  ReceiptText,
  Search,
  Settings2,
  ShieldCheck,
  UsersRound,
  WalletCards,
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import type { AuthUser } from "@/lib/api";
import { useLanguage } from "@/i18n";

type Screen = string;
type NavigationItem = { id: Screen; en: string; zh: string; icon: typeof LayoutDashboard };

const adminNav: NavigationItem[] = [
  { id: "overview", en: "Overview", zh: "概览", icon: LayoutDashboard },
  { id: "payroll", en: "Payroll", zh: "工资批次", icon: CircleDollarSign },
  { id: "people", en: "Team payouts", zh: "团队收款", icon: UsersRound },
  { id: "records", en: "Payment records", zh: "付款记录", icon: ReceiptText },
  { id: "settings", en: "Settings", zh: "设置", icon: Settings2 },
];

const employeeNav: NavigationItem[] = [
  { id: "home", en: "My pay", zh: "我的工资", icon: LayoutDashboard },
  { id: "history", en: "Payment history", zh: "收款记录", icon: Activity },
  { id: "payout", en: "Payout method", zh: "收款方式", icon: WalletCards },
  { id: "documents", en: "Documents", zh: "合同与凭证", icon: FileText },
];

interface ShellProps {
  user: AuthUser;
  orgName?: string;
  memberCount?: number;
  attentionCount?: number;
  screen: Screen;
  onNavigate: (screen: Screen) => void;
  onLogout: () => void;
  children: ReactNode;
}

function initials(name: string) {
  return name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

function AppSidebar({
  user,
  screen,
  attentionCount,
  onNavigate,
  onLogout,
}: Pick<ShellProps, "user" | "screen" | "attentionCount" | "onNavigate" | "onLogout">) {
  const { text } = useLanguage();
  const { isMobile, setOpenMobile } = useSidebar();
  const isAdmin = user.role === "admin";
  const nav = isAdmin ? adminNav : employeeNav;

  const navigate = (destination: Screen) => {
    onNavigate(destination);
    if (isMobile) setOpenMobile(false);
  };

  return (
    <Sidebar collapsible="icon" aria-label={text("Primary navigation", "主导航")}>
      <SidebarHeader className="border-b">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              className="gap-3 data-[active=true]:bg-transparent"
              onClick={() => navigate(isAdmin ? "overview" : "home")}
              tooltip="SalaryFlow"
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">
                SF
              </span>
              <span className="grid flex-1 text-left leading-tight">
                <span className="truncate font-semibold">SalaryFlow</span>
                <span className="truncate text-xs text-muted-foreground">Stablecoin payroll</span>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{isAdmin ? text("Workspace", "工作台") : text("Employee portal", "员工门户")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {nav.map(({ id, en, zh, icon: Icon }) => (
                <SidebarMenuItem key={id}>
                  <SidebarMenuButton
                    isActive={screen === id}
                    onClick={() => navigate(id)}
                    tooltip={text(en, zh)}
                  >
                    <Icon aria-hidden="true" />
                    <span>{text(en, zh)}</span>
                  </SidebarMenuButton>
                  {id === "people" && isAdmin && (attentionCount ?? 0) > 0 && (
                    <SidebarMenuBadge>{attentionCount}</SidebarMenuBadge>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-auto group-data-[collapsible=icon]:hidden">
          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="flex items-center gap-2 text-xs font-medium">
              <ShieldCheck className="size-4 text-emerald-600" />
              Payments are locked
            </div>
            <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
              Readiness checks are local dry-runs. No funds can move.
            </p>
          </div>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg" className="data-open:bg-sidebar-accent">
                  <Avatar className="size-8 rounded-lg">
                    <AvatarFallback className="rounded-lg bg-primary/10 font-medium text-primary">
                      {initials(user.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="grid flex-1 text-left leading-tight">
                    <span className="truncate font-medium">{user.name}</span>
                    <span className="truncate text-xs text-muted-foreground">{user.email}</span>
                  </span>
                  <ChevronsUpDown className="ml-auto" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right" align="end" className="min-w-56">
                <DropdownMenuLabel>
                  {isAdmin ? text("Payroll administrator", "工资管理员") : text("Team member", "团队成员")}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={onLogout} variant="destructive">
                  <LogOut />
                  {text("Sign out", "退出登录")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

export function Shell({
  user,
  orgName,
  memberCount,
  attentionCount,
  screen,
  onNavigate,
  onLogout,
  children,
}: ShellProps) {
  const { text } = useLanguage();
  const isAdmin = user.role === "admin";
  const topNav = (isAdmin ? adminNav : employeeNav).slice(0, 4);

  return (
    <SidebarProvider
      style={{ "--sidebar-width": "15rem" } as CSSProperties}
    >
        <a className="skip-link" href="#main-content">
          {text("Skip to main content", "跳到主要内容")}
        </a>
        <AppSidebar
          user={user}
          screen={screen}
          attentionCount={attentionCount}
          onNavigate={onNavigate}
          onLogout={onLogout}
        />

        <SidebarInset id="main-content" tabIndex={-1} className="min-w-0">
          <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur supports-backdrop-filter:bg-background/80">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-1 h-4" />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="min-w-0 justify-start px-2">
                  <span className="grid size-6 shrink-0 place-items-center rounded-md bg-primary text-[10px] font-semibold text-primary-foreground">
                    {orgName?.[0]?.toUpperCase() || "W"}
                  </span>
                  <span className="max-w-36 truncate font-medium">{orgName || "Workspace"}</span>
                  <ChevronsUpDown className="text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-64">
                <DropdownMenuLabel>Current workspace</DropdownMenuLabel>
                <DropdownMenuItem onSelect={() => onNavigate(isAdmin ? "overview" : "home")}>
                  <span className="grid size-7 place-items-center rounded-md bg-primary text-xs font-semibold text-primary-foreground">
                    {orgName?.[0]?.toUpperCase() || "W"}
                  </span>
                  <span className="flex flex-col">
                    <strong className="font-medium">{orgName || "Workspace"}</strong>
                    <small className="text-xs text-muted-foreground">
                      {memberCount ?? 0} {(memberCount ?? 0) === 1 ? "member" : "members"}
                    </small>
                  </span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <nav className="hidden h-full items-center gap-1 min-[1180px]:flex" aria-label={text("Quick navigation", "快捷导航")}>
              {topNav.map(({ id, en, zh }) => (
                <button
                  key={id}
                  type="button"
                  className={`relative h-full whitespace-nowrap px-2 text-sm transition-colors hover:text-foreground ${screen === id ? "font-medium text-foreground after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:bg-primary" : "text-muted-foreground"}`}
                  onClick={() => onNavigate(id)}
                >
                  {text(id === "people" ? "Team" : id === "records" ? "Records" : en, zh)}
                </button>
              ))}
            </nav>

            <div className="ml-auto flex items-center gap-2">
              <div className="relative hidden md:block">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input className="h-8 w-44 pl-8 lg:w-56" aria-label="Search workspace" placeholder="Search workspace…" />
              </div>
              <Badge variant="outline" className="hidden gap-1.5 border-emerald-200 bg-emerald-50 text-emerald-700 sm:inline-flex">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                {text("Payments dry-run", "支付仅演练")}
              </Badge>
              <ThemeToggle />
              <Button variant="ghost" size="icon" disabled aria-label={text("Notifications unavailable", "通知功能暂不可用")}>
                <Bell />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full">
                    <Avatar className="size-8">
                      <AvatarFallback className="bg-primary/10 text-xs font-medium text-primary">
                        {initials(user.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="sr-only">Open user menu</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-52">
                  <DropdownMenuLabel className="flex flex-col">
                    <span>{user.name}</span>
                    <span className="font-normal text-muted-foreground">{user.email}</span>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={onLogout} variant="destructive">
                    <LogOut />
                    {text("Sign out", "退出登录")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>
          <div className="flex-1">{children}</div>
        </SidebarInset>
    </SidebarProvider>
  );
}
