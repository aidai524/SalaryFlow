// App shell: sidebar + topbar, navigation driven by the authenticated user's role

import {
  Activity,
  Bell,
  ChevronDown,
  CircleDollarSign,
  LayoutDashboard,
  LogOut,
  ReceiptText,
  Settings2,
  UsersRound,
  WalletCards,
  FileText,
} from "lucide-react";
import type { ReactNode } from "react";
import type { AuthUser } from "../lib/api";
import { useLanguage } from "../i18n";

type Screen = string;

const adminNav: Array<{ id: Screen; en: string; zh: string; icon: typeof LayoutDashboard }> = [
  { id: "overview", en: "Overview", zh: "概览", icon: LayoutDashboard },
  { id: "payroll", en: "Payroll", zh: "工资批次", icon: CircleDollarSign },
  { id: "people", en: "Team payouts", zh: "团队收款", icon: UsersRound },
  { id: "records", en: "Payment records", zh: "付款记录", icon: ReceiptText },
  { id: "settings", en: "Settings", zh: "设置", icon: Settings2 },
];

const employeeNav: Array<{ id: Screen; en: string; zh: string; icon: typeof LayoutDashboard }> = [
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
  onNavigate: (s: Screen) => void;
  onLogout: () => void;
  children: ReactNode;
}

export function Shell({ user, orgName, memberCount, attentionCount, screen, onNavigate, onLogout, children }: ShellProps) {
  const { text } = useLanguage();
  const isAdmin = user.role === "admin";
  const nav = isAdmin ? adminNav : employeeNav;

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">{text("Skip to main content", "跳到主要内容")}</a>
      <aside className="sidebar" aria-label={text("Primary navigation", "主导航")}>
        <button className="brand" type="button" onClick={() => onNavigate(isAdmin ? "overview" : "home")}>
          <span className="brand-mark" aria-hidden="true"><span>SF</span></span>
          <span className="brand-copy"><strong>SalaryFlow</strong><small>{text("Stablecoin payroll", "稳定币工资支付")}</small></span>
        </button>

        <nav className="primary-nav">
          <span className="nav-label">{isAdmin ? text("Workspace", "工作台") : text("Employee portal", "员工门户")}</span>
          {nav.map(({ id, en, zh, icon: Icon }) => (
            <button key={id} type="button" className={`nav-item${screen === id ? " is-active" : ""}`} onClick={() => onNavigate(id)} aria-current={screen === id ? "page" : undefined}>
              <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
              <span>{text(en, zh)}</span>
              {id === "people" && isAdmin && (attentionCount ?? 0) > 0 && <span className="nav-count">{attentionCount}</span>}
            </button>
          ))}
        </nav>

        <div className="sidebar-foot">
          <span className="avatar" aria-hidden="true">{user.name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase()}</span>
          <span className="operator-copy"><strong>{user.name}</strong><small>{isAdmin ? text("Payroll admin", "工资管理员") : text("Team member", "团队成员")}</small></span>
          <button className="logout-button" type="button" onClick={onLogout} aria-label={text("Sign out", "退出登录")} title={text("Sign out", "退出登录")}>
            <LogOut size={15} />
          </button>
        </div>
      </aside>

      <section className="app-main">
        <header className="topbar">
          <div className="workspace-switcher">
            <span className="company-avatar" aria-hidden="true">{orgName?.[0] || "N"}</span>
            <span><strong>{orgName || "Workspace"}</strong><small>{memberCount !== undefined ? `${memberCount} ${memberCount === 1 ? "member" : "members"}` : (isAdmin ? "Administrator" : "Employee portal")}</small></span>
            <ChevronDown size={15} aria-hidden="true" />
          </div>
          <div className="topbar-actions">
            <span className="demo-status"><i aria-hidden="true" />{text("Connected · real API", "已连接 · 真实 API")}</span>
            <span className="role-chip">{isAdmin ? text("Administrator", "管理员") : text("Employee", "员工")}</span>
            <button className="icon-button" type="button" aria-label={text("Notifications unavailable in prototype", "原型暂不支持通知")} title={text("Notifications are not implemented", "通知功能尚未实现")} disabled><Bell size={19} aria-hidden="true" /></button>
          </div>
        </header>
        <main id="main-content">{children}</main>
      </section>
    </div>
  );
}
