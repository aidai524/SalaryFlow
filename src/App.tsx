import { useCallback, useEffect, useState } from "react";
import { Shell } from "./components/Shell";
import { LoginPage, InvitePage } from "./auth/AuthPages";
import { WalletConnectDialog } from "./components/WalletConnect";
import { OverviewPage } from "./pages/admin/Overview";
import { PayrollPage } from "./pages/admin/Payroll";
import { TeamPayoutsPage } from "./pages/admin/TeamPayouts";
import { RecordsPage } from "./pages/admin/Records";
import { SettingsPage } from "./pages/admin/Settings";
import { EmployeeHomePage, EmployeeHistoryPage, EmployeePayoutPage, EmployeeDocumentsPage } from "./pages/employee/EmployeePages";
import { api, type AuthUser } from "./lib/api";

function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [screen, setScreen] = useState("overview");
  const [showWallet, setShowWallet] = useState(false);
  const [orgName, setOrgName] = useState("");
  const [memberCount, setMemberCount] = useState(0);
  const [attentionCount, setAttentionCount] = useState(0);

  useEffect(() => {
    api.me()
      .then((r) => {
        if (r.user) {
          setUser(r.user);
          setScreen(r.user.role === "admin" ? "overview" : "home");
          if (r.user.role === "admin") {
            api.org().then((o) => { setOrgName(o.org.name); setMemberCount(o.members.length); }).catch(() => {});
            api.listEmployees().then((e) => setAttentionCount(e.employees.filter((x) => x.status !== "ready").length)).catch(() => {});
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleOrgChange = useCallback((name: string, members: number) => {
    setOrgName(name);
    setMemberCount(members);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch { /* ignore */ }
    setUser(null);
    setScreen("overview");
  }, []);

  if (loading) {
    return <div className="splash-screen"><span className="splash-mark">SF</span><p>SalaryFlow</p></div>;
  }

  // Not authenticated → auth pages (invite route by path)
  if (!user) {
    const inviteMatch = window.location.pathname.match(/^\/invite\//);
    return (
      <div>
        {inviteMatch ? (
          <InvitePage onAuthed={(u) => { setUser(u); setScreen(u.role === "admin" ? "overview" : "home"); }} onGoLogin={() => window.history.replaceState({}, "", "/")} />
        ) : (
          <LoginPage onAuthed={(u) => { setUser(u); setScreen(u.role === "admin" ? "overview" : "home"); }} onGoInvite={() => window.history.replaceState({}, "", "/invite/")} />
        )}
      </div>
    );
  }

  const isAdmin = user.role === "admin";
  const requireWallet = () => setShowWallet(true);

  return (
    <Shell user={user} orgName={orgName} memberCount={memberCount} attentionCount={attentionCount} screen={screen} onNavigate={setScreen} onLogout={logout}>
      {isAdmin ? (
        screen === "overview" ? <OverviewPage user={user} onNavigate={setScreen} />
        : screen === "payroll" ? <PayrollPage user={user} onRequireWallet={requireWallet} />
        : screen === "people" ? <TeamPayoutsPage onRequireWallet={requireWallet} onNavigate={setScreen} />
        : screen === "records" ? <RecordsPage />
        : <SettingsPage user={user} onUserChange={setUser} onOrgChange={handleOrgChange} />
      ) : (
        screen === "home" ? <EmployeeHomePage user={user} />
        : screen === "history" ? <EmployeeHistoryPage />
        : screen === "payout" ? <EmployeePayoutPage />
        : <EmployeeDocumentsPage user={user} />
      )}

      {showWallet && <WalletConnectDialog user={user} onClose={() => setShowWallet(false)} onBound={(address) => { setShowWallet(false); setUser({ ...user, wallet_address: address, wallet_verified: true }); }} />}
    </Shell>
  );
}

export default App;
