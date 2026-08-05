// Admin: Overview — next payroll, action items, recent activity

import { useEffect } from "react";
import { ArrowRight, CalendarDays, Check, CircleAlert, Clock3, CircleDollarSign, UsersRound, EyeOff } from "lucide-react";
import { api, type PayrollRun, type AuthUser } from "../../lib/api";
import { useApi, formatMoney } from "../../lib/useData";

export function OverviewPage({ user, onNavigate }: { user: AuthUser; onNavigate: (s: string) => void }) {
  const { data: org } = useApi(() => api.org(), []);
  const { data: runs } = useApi(() => api.listRuns(), []);
  const { data: employees } = useApi(() => api.listEmployees(), []);
  const { data: records } = useApi(() => api.listRecords(), []);

  useEffect(() => {
    document.title = "SalaryFlow · Overview";
  }, []);

  const latest = runs?.runs[0] as PayrollRun | undefined;
  const paid = latest?.status === "paid";
  const readyCount = employees?.employees.filter((e) => e.status === "ready").length ?? 0;
  const attentionCount = (employees?.employees.length ?? 0) - readyCount;
  const confirmedRecords = records?.records.filter((r) => r.status === "confirmed").length ?? 0;

  return (
    <div className="secondary-page overview-page">
      <section className="overview-welcome">
        <div><span className="eyebrow">{(new Date()).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</span><h1>Good {new Date().getHours() < 12 ? "morning" : "afternoon"}, {user.name.split(" ")[0]}</h1><p>Your payroll workspace is ready. Review the latest run and team status.</p></div>
        <button className="button button-primary" type="button" onClick={() => onNavigate("payroll")}><CircleDollarSign size={17} />Open payroll run</button>
      </section>

      <section className="next-run-card">
        <div className="run-card-main">
          <span className="run-kicker"><CalendarDays size={15} />Next payment · {latest?.pay_date ?? "—"}</span>
          <div className="run-title-row"><div><h2>{latest?.label ?? "No payroll runs yet"}</h2><p>{latest ? `${latest.itemCount} payments · USDC and USDT` : "Create your first run from the Payroll page"}</p></div><span className={`large-state state-${latest?.status === "paid" ? "paid" : "ready"}`}>{latest ? (paid ? "Paid" : latest.status === "draft" ? "Draft" : "Ready") : "No run"}</span></div>
          <div className="run-amounts"><div><span>USDC</span><strong>{formatMoney(latest?.usdc ?? 0)}</strong></div><div><span>USDT</span><strong>{formatMoney(latest?.usdt ?? 0)}</strong></div></div>
          <div className="run-progress"><span style={{ width: paid ? "100%" : "58%" }} /><i className="progress-stop stop-one" /><i className="progress-stop stop-two" /><i className="progress-stop stop-three" /></div>
          <div className="run-progress-labels"><span>Pay confirmed</span><span>Payouts checked</span><span>{paid ? "Paid" : "Ready to pay"}</span><span>Payment</span></div>
          {latest && <button className="text-action" type="button" onClick={() => onNavigate("payroll")}>View run details <ArrowRight size={14} /></button>}
        </div>
        <aside className="run-card-aside">
          <span className="aside-label">Before you pay</span>
          <button type="button" onClick={() => onNavigate("people")}><span className="task-icon task-warn"><CircleAlert size={17} /></span><span><strong>{attentionCount} employees</strong><small>Payout details need updates</small></span><ArrowRight size={16} /></button>
          <button type="button" onClick={() => onNavigate("records")}><span className="task-icon"><ReceiptMini /></span><span><strong>{confirmedRecords} confirmed on-chain</strong><small>View payment records</small></span><ArrowRight size={16} /></button>
        </aside>
      </section>

      <section className="overview-grid">
        <article className="balance-card">
          <header><div><span className="section-icon"><UsersRound size={18} /></span><div><h2>Team payouts</h2><p>Payout methods</p></div></div><button type="button" onClick={() => onNavigate("people")}>Manage</button></header>
          <div className="balance-row"><span className="coin coin-usdc">$</span><div><strong>{readyCount} ready to pay</strong><small>Verified addresses</small></div><span className="balance-number">USDC + USDT</span></div>
          <div className="balance-row"><span className="coin coin-usdt">₮</span><div><strong>{attentionCount} need attention</strong><small>Address or verification</small></div><span className="balance-number">Update</span></div>
          <footer><EyeOff size={14} /><span>Employees only see their own payout details.</span></footer>
        </article>

        <article className="activity-card">
          <header><div><span className="section-icon"><CircleDollarSign size={18} /></span><div><h2>Payroll</h2><p>Latest runs</p></div></div><button type="button" onClick={() => onNavigate("payroll")}>View all</button></header>
          <ul>
            {(runs?.runs ?? []).slice(0, 3).map((run) => (
              <li key={run.id}><span className={`activity-mark ${run.status === "paid" ? "is-done" : ""}`}>{run.status === "paid" ? <Check size={13} /> : <Clock3 size={13} />}</span><div><strong>{run.label}</strong><small>{run.status} · {run.itemCount} payments</small></div></li>
            ))}
            {(runs?.runs ?? []).length === 0 && <li><span className="activity-mark"><Clock3 size={13} /></span><div><strong>No payroll runs yet</strong><small>Create one from the Payroll page</small></div></li>}
          </ul>
        </article>
      </section>
    </div>
  );
}

function ReceiptMini() {
  return <span className="task-icon"><CircleDollarSign size={17} /></span>;
}
