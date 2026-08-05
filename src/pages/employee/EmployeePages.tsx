// Employee portal pages: My pay, Payment history, Payout method, Documents & consent

import { useEffect, useState } from "react";
import { AlertCircle, CalendarDays, Check, CheckCircle2, Clock3, EyeOff, FileSignature, LockKeyhole, Save, WalletCards } from "lucide-react";
import { api, type AuthUser } from "../../lib/api";
import { useApi, formatMoney } from "../../lib/useData";

function EmployeeFrame({ children }: { children: React.ReactNode }) {
  return <div className="employee-page">{children}</div>;
}

export function EmployeeHomePage({ user }: { user: AuthUser }) {
  const { data: payout } = useApi(() => api.myPayout(), []);
  const { data: records } = useApi(() => api.myRecords(), []);
  useEffect(() => {
    document.title = "SalaryFlow · My pay";
  }, []);
  const emp = payout?.payout;
  const recent = records?.records[0];

  return (
    <EmployeeFrame>
      <section className="employee-welcome">
        <div><span className="eyebrow">My pay</span><h1>Hi, {user.name.split(" ")[0]}</h1><p>Your pay is being prepared. Review your payout method and records below.</p></div>
        <span className="employee-company"><i>N</i><span><strong>Northstar Labs</strong><small>{emp?.role_title || "Team member"}</small></span></span>
      </section>

      <section className="employee-pay-hero">
        <div className="employee-pay-main">
          <span className="employee-pay-label"><CalendarDays size={15} />Next payday · see payroll schedule</span>
          <div className="employee-amount"><strong>{emp ? formatMoney(emp.amount) : "—"}</strong><span>{emp?.token ?? "USDC"}</span></div>
          <p>This is your net amount. Your employer covers payment fees.</p>
          <span className="employee-pay-state"><Clock3 size={14} />Waiting for payment</span>
        </div>
        <aside className="employee-destination">
          <header><span>Payout method</span></header>
          <div className="destination-token"><i>{emp?.token === "USDT" ? "₮" : "$"}</i><span><strong>{emp?.token ?? "USDC"}</strong><small>{emp?.network ?? "Base"} network</small></span></div>
          <div className="destination-address"><span>Wallet address</span><strong className="mono-value">{emp?.endpoint ? `${emp.endpoint.slice(0, 6)}…${emp.endpoint.slice(-4)}` : "Not set"}</strong></div>
          <div className="destination-check"><CheckCircle2 size={14} /><span>{emp?.status === "ready" ? "Ready to receive" : "Awaiting verification"}</span></div>
        </aside>
      </section>

      <section className="employee-grid">
        <article className="employee-progress-card">
          <header><div><h2>Where your pay is now</h2><p>Updates appear here as the status changes.</p></div><span>Latest payment</span></header>
          <ol>
            <li className="is-done"><span><Check size={14} /></span><div><strong>Net pay confirmed</strong><small>{recent ? `${formatMoney(recent.amount)} ${recent.token}` : "Amount set on payroll run"}</small></div></li>
            <li className="is-current"><span>2</span><div><strong>Waiting for payment</strong><small>Your employer pays via confidential swap</small></div></li>
            <li><span>3</span><div><strong>Pay received</strong><small>A receipt will be available after confirmation</small></div></li>
          </ol>
        </article>
        <article className="employee-privacy-card">
          <span className="employee-card-icon"><EyeOff size={20} /></span>
          <h2>Your pay is yours alone</h2>
          <p>Coworkers cannot see your amount or wallet. Only authorized payroll staff receive the information needed for their work.</p>
          <ul><li><Check size={13} />Hidden from coworkers</li><li><Check size={13} />Wallet address is masked</li><li><Check size={13} />Swap amounts hidden on-chain</li></ul>
        </article>
      </section>
      <p className="employee-demo-note"><AlertCircle size={14} />Connected to the live SalaryFlow API. Payment records update as swaps confirm.</p>
    </EmployeeFrame>
  );
}

export function EmployeeHistoryPage() {
  const { data, loading } = useApi(() => api.myRecords(), []);
  const records = data?.records ?? [];
  return (
    <EmployeeFrame>
      <section className="employee-heading"><div><span className="eyebrow">Payment history</span><h1>My pay history</h1><p>Review each amount, network, and status.</p></div></section>
      {loading && <p className="page-empty">Loading…</p>}
      {!loading && records.length === 0 && <section className="empty-state"><h2>No payments yet</h2><p>Your payments will appear here once payroll is sent.</p></section>}
      {records.length > 0 && (
        <section className="employee-history-card">
          <header><div><h2>Payments</h2><p>Only you can view these records.</p></div></header>
          <div className="table-scroll">
            <table className="employee-history-table">
              <thead><tr><th>Pay period</th><th>Net amount</th><th>Network</th><th>Status</th><th>Intent</th></tr></thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id}>
                    <td><span className="month-cell"><strong>{r.employee_name}</strong></span></td>
                    <td><strong>{formatMoney(r.amount)} {r.token}</strong></td>
                    <td>{r.token} · {r.network}</td>
                    <td><span className={`status-chip ${r.status === "paid" ? "status-paid" : "status-pending"}`}>{r.status === "paid" ? <CheckCircle2 size={14} /> : <Clock3 size={14} />}{r.status}</span></td>
                    <td>{r.intent_hash ? <span className="mono-value">{r.intent_hash.slice(0, 14)}…</span> : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </EmployeeFrame>
  );
}

export function EmployeePayoutPage() {
  const { data, refresh } = useApi(() => api.myPayout(), []);
  const [token, setToken] = useState("USDC");
  const [network, setNetwork] = useState("Base");
  const [endpoint, setEndpoint] = useState("");
  const [saved, setSaved] = useState(false);
  const [notice, setNotice] = useState("");

  const emp = data?.payout;
  useEffect(() => {
    if (emp) {
      setToken(emp.token);
      setNetwork(emp.network);
      setEndpoint(emp.endpoint || "");
    }
  }, [emp?.id]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.updatePayout({ token, network, endpoint });
    setSaved(true);
    setNotice("Payout details updated — re-verification required before the next payment.");
    refresh();
    setTimeout(() => setSaved(false), 4000);
  };

  return (
    <EmployeeFrame>
      <section className="employee-heading"><div><span className="eyebrow">Payout method</span><h1>Where your pay goes</h1><p>Choose your stablecoin, network, and wallet.</p></div></section>
      <section className="payout-settings-layout">
        <form className="employee-payout-form" onSubmit={save}>
          <header><div><h2>Current payout method</h2><p>Changes apply to payroll runs that have not been sent.</p></div><span className="status-chip status-ready"><CheckCircle2 size={14} />{emp?.status === "ready" ? "Ready" : "Needs verification"}</span></header>
          <div className="employee-form-row"><label>Stablecoin<span>The currency you receive</span></label><div className="token-choice">{(["USDC", "USDT"] as const).map((item) => <button type="button" key={item} className={token === item ? "is-active" : ""} onClick={() => { setToken(item); setSaved(false); }}><i>{item === "USDC" ? "$" : "₮"}</i><span><strong>{item}</strong><small>{item === "USDC" ? "USD Coin" : "Tether"}</small></span></button>)}</div></div>
          <div className="employee-form-row"><label htmlFor="employee-network">Payout network<span>Your wallet must support it</span></label><select id="employee-network" value={network} onChange={(e) => setNetwork(e.target.value)}><option>Base</option><option>Arbitrum</option><option>Polygon</option><option>Optimism</option><option>Ethereum</option></select></div>
          <div className="employee-form-row address-row"><label htmlFor="employee-address">Wallet address<span>Changes require reverification</span></label><div><input id="employee-address" value={endpoint} onChange={(e) => setEndpoint(e.target.value)} placeholder="0x…" /><small className="address-preview"><LockKeyhole size={12} />Employer views show only {endpoint.slice(0, 6) || "…"}…{endpoint.slice(-4) || "…"}</small></div></div>
          <footer>
            <span className={saved ? "save-result is-visible" : "save-result"}><Check size={14} />Saved</span>
            <button className="button button-primary" type="submit"><Save size={16} />Save payout method</button>
          </footer>
        </form>
        <aside className="payout-guidance">
          <span className="employee-card-icon"><WalletCards size={20} /></span>
          <h2>Check before you save</h2>
          <ul><li><span>01</span><p>Your wallet supports the selected asset and network.</p></li><li><span>02</span><p>You control this address.</p></li><li><span>03</span><p>Incorrect addresses can delay or lose funds.</p></li></ul>
        </aside>
      </section>
      {notice && <p className="employee-demo-note"><AlertCircle size={14} />{notice}</p>}
    </EmployeeFrame>
  );
}

export function EmployeeDocumentsPage({ user }: { user: AuthUser }) {
  const { data, refresh } = useApi(() => api.myConsent(), []);
  const [notice, setNotice] = useState("");

  const sign = async () => {
    await api.signConsent({ consent: "stablecoin-payout", version: "1", acceptedAt: new Date().toISOString(), employeeId: user.id });
    setNotice("Consent recorded for this session.");
    refresh();
  };

  return (
    <EmployeeFrame>
      <section className="employee-heading"><div><span className="eyebrow">Documents and proof</span><h1>My payroll documents</h1><p>Consent and payslips live here in one private place.</p></div><span className="employee-verified"><CheckCircle2 size={15} />Private to you</span></section>
      <section className="data-card">
        <header className="card-header"><div><h2>Stablecoin payout consent</h2><p>Authorizes SalaryFlow to deliver net pay in your selected stablecoin.</p></div><span className={`status-chip ${data?.signed ? "status-ready" : "status-pending"}`}>{data?.signed ? <CheckCircle2 size={14} /> : <Clock3 size={14} />}{data?.signed ? "Signed" : "Unsigned"}</span></header>
        <div className="consent-body">
          <p>Your employment agreement remains denominated in USD. This consent authorizes the delivery of net amounts in USDC or USDT to your verified wallet. Swap execution happens on a private chain; deposit and withdrawal transactions on public chains remain visible to parties that need them.</p>
          {data?.signed ? (
            <p className="consent-signed"><Check size={14} />Signed {data.signedAt ? new Date(data.signedAt).toLocaleString() : ""}</p>
          ) : (
            <button className="button button-primary" type="button" onClick={sign}><FileSignature size={16} />Review and sign consent</button>
          )}
          {notice && <p className="employee-demo-note"><AlertCircle size={14} />{notice}</p>}
        </div>
      </section>
      <p className="employee-demo-note"><AlertCircle size={14} />Records are stored in SalaryFlow. Production integrates a compliant e-signature provider and trusted timestamps.</p>
    </EmployeeFrame>
  );
}
