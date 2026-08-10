import { useCallback, useEffect, useState } from "react";
import { Shell } from "./components/Shell";
import { ThemeToggle } from "./components/ThemeToggle";
import { LoginPage, InvitePage } from "./auth/AuthPages";
import { OverviewPage } from "./pages/admin/Overview";
import { PayrollPage } from "./pages/admin/Payroll";
import { TeamPayoutsPage } from "./pages/admin/TeamPayouts";
import { RecordsPage } from "./pages/admin/Records";
import { SettingsPage } from "./pages/admin/Settings";
import { EmployeeHomePage, EmployeeHistoryPage, EmployeePayoutPage } from "./pages/employee/EmployeePages";
import { api, type AuthUser } from "./lib/api";

function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [authPath, setAuthPath] = useState(() => window.location.pathname);
  const [screen, setScreen] = useState("overview");
  const [orgName, setOrgName] = useState("");
  const [memberCount, setMemberCount] = useState(0);
  const [attentionCount, setAttentionCount] = useState(0);

  const navigateAuth = useCallback((path: string) => {
    window.history.replaceState({}, "", path);
    setAuthPath(path);
  }, []);

  const loadWorkspaceContext = useCallback((nextUser: AuthUser) => {
    const contextRequest = api.orgContext().then((context) => {
      setOrgName(context.org.name);
      setMemberCount(context.memberCount);
    });
    const attentionRequest = nextUser.role === "admin"
      ? api.listEmployees().then((result) => setAttentionCount(result.employees.filter((employee) => employee.status !== "ready").length))
      : Promise.resolve(setAttentionCount(0));
    void Promise.all([contextRequest, attentionRequest]).catch(() => {});
  }, []);

  const handleAuthed = useCallback((nextUser: AuthUser) => {
    navigateAuth("/");
    setUser(nextUser);
    setScreen(nextUser.role === "admin" ? "overview" : "home");
    loadWorkspaceContext(nextUser);
  }, [loadWorkspaceContext, navigateAuth]);

  useEffect(() => {
    api.me()
      .then((r) => {
        if (r.user) {
          handleAuthed(r.user);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [handleAuthed]);

  useEffect(() => {
    const syncPath = () => setAuthPath(window.location.pathname);
    window.addEventListener("popstate", syncPath);
    return () => window.removeEventListener("popstate", syncPath);
  }, []);

  useEffect(() => {
    if (!user) return;
    const titles: Record<string, string> = {
      overview: "Overview",
      payroll: "Payroll",
      people: "Team payouts",
      records: "Payment records",
      settings: "Settings",
      home: "My pay",
      history: "Payment history",
      payout: "Payout method",
    };
    document.title = `SalaryFlow · ${titles[screen] || "Workspace"}`;
  }, [screen, user]);

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
    setOrgName("");
    setMemberCount(0);
    setAttentionCount(0);
  }, []);

  if (loading) {
    return <div className="splash-screen"><div><span className="splash-mark">SF</span><p>Loading SalaryFlow…</p></div></div>;
  }

  // Not authenticated → auth pages (invite route by path)
  if (!user) {
    const inviteMatch = authPath.match(/^\/invite\//);
    return (
      <div className="relative min-h-svh">
        <div className="fixed top-4 right-4 z-10">
          <ThemeToggle />
        </div>
        {inviteMatch ? (
          <InvitePage onAuthed={handleAuthed} onGoLogin={() => navigateAuth("/")} />
        ) : (
          <LoginPage onAuthed={handleAuthed} onGoInvite={() => navigateAuth("/invite/")} />
        )}
      </div>
    );
  }

  const isAdmin = user.role === "admin";
  return (
    <Shell user={user} orgName={orgName} memberCount={memberCount} attentionCount={attentionCount} screen={screen} onNavigate={setScreen} onLogout={logout} onUserChange={setUser}>
      {isAdmin ? (
        screen === "overview" ? <OverviewPage user={user} onNavigate={setScreen} />
        : screen === "payroll" ? <PayrollPage user={user} />
        : screen === "people" ? <TeamPayoutsPage onNavigate={setScreen} />
        : screen === "records" ? <RecordsPage />
        : <SettingsPage user={user} onUserChange={setUser} onOrgChange={handleOrgChange} />
      ) : (
        screen === "history" ? <EmployeeHistoryPage />
        : screen === "payout" ? <EmployeePayoutPage />
        : <EmployeeHomePage user={user} orgName={orgName} />
      )}
    </Shell>
  );
}

export default App;
