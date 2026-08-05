// Admin: Team payouts — employee directory, invitation management, pre-payment reminders

import { useState } from "react";
import { AlertCircle, CheckCircle2, Clock3, Copy, EyeOff, Link2, Plus, Send } from "lucide-react";
import { api, type Employee } from "../../lib/api";
import { useApi, formatMoney, initials } from "../../lib/useData";

export function TeamPayoutsPage({ onRequireWallet, onNavigate }: { onRequireWallet: () => void; onNavigate: (s: string) => void }) {
  const { data, refresh } = useApi(() => api.listEmployees(), []);
  const { data: invites, refresh: refreshInvites } = useApi(() => api.listInvites(), []);
  const employees = data?.employees ?? [];
  const attention = employees.filter((e) => e.status !== "ready");
  const readyCount = employees.filter((e) => e.status === "ready").length;

  return (
    <div className="secondary-page">
      <section className="secondary-heading">
        <div><span className="eyebrow">Team payouts</span><h1>Employees and payout methods</h1><p>Employees choose their stablecoin and network. Check the status, then pay the batch directly.</p></div>
        <button className="button button-primary" type="button" onClick={onRequireWallet}><Send size={17} />Pay now</button>
      </section>

      <section className="people-summary">
        <div><strong>{employees.length}</strong><span>Team members</span></div>
        <div><strong>{readyCount}</strong><span>Ready to pay</span></div>
        <div><strong>{attention.length}</strong><span>Need attention</span></div>
        <div className="summary-protection"><EyeOff size={19} /><span><strong>Data separation enabled</strong><small>Employees can only see their own payout details</small></span></div>
      </section>

      {attention.length > 0 && (
        <section className="attention-card">
          <header><div><span className="task-icon task-warn"><AlertCircle size={18} /></span><div><h2>Review before payment</h2><p>{attention.length} employees need updates. Resolve these before paying the batch.</p></div></div></header>
          <div className="attention-list">
            {attention.map((e) => (
              <div key={e.id}>
                <span className="person-avatar">{initials(e.name)}</span>
                <span><strong>{e.name}</strong><small>{e.role_title || e.location || e.network}</small></span>
                <span className={`status-chip ${e.status === "pending" ? "status-pending" : "status-update_required"}`}>{e.status === "pending" ? <Clock3 size={14} /> : <AlertCircle size={14} />}{e.status === "pending" ? "Verification pending" : "Update required"}</span>
                <button type="button" onClick={() => onNavigate("payroll")}>Review →</button>
              </div>
            ))}
          </div>
        </section>
      )}

      <EmployeeTable employees={employees} />

      <InviteManager pendingInvites={invites?.invitations ?? []} onChanged={() => { refresh(); refreshInvites(); }} />

      <div className="prototype-inline-note"><AlertCircle size={15} /><span>Invitations are sent by email (Resend). Wallet addresses are masked in the UI; full addresses live in the secure employee record.</span></div>
    </div>
  );
}

function EmployeeTable({ employees }: { employees: Employee[] }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [location, setLocation] = useState("");
  const [token, setToken] = useState("USDC");
  const [network, setNetwork] = useState("Base");

  const add = async () => {
    if (!name) return;
    await api.createEmployee({ name, role_title: roleTitle, location, token: token as "USDC" | "USDT", network });
    setName(""); setRoleTitle(""); setLocation("");
    setAdding(false);
    window.location.reload();
  };

  return (
    <section className="data-card" style={{ marginBottom: 18 }}>
      <header className="card-header">
        <div><h2>Team directory</h2><p>{employees.length} employees on file.</p></div>
        <button className="button button-secondary" type="button" onClick={() => setAdding((v) => !v)}><Plus size={15} />Add employee</button>
      </header>
      {adding && (
        <div className="add-item-row">
          <input placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />
          <input placeholder="Role" value={roleTitle} onChange={(e) => setRoleTitle(e.target.value)} />
          <input placeholder="Location" value={location} onChange={(e) => setLocation(e.target.value)} />
          <select value={token} onChange={(e) => setToken(e.target.value)}><option>USDC</option><option>USDT</option></select>
          <select value={network} onChange={(e) => setNetwork(e.target.value)}><option>Base</option><option>Arbitrum</option><option>Polygon</option><option>Optimism</option></select>
          <button className="button button-primary" type="button" onClick={add}>Add</button>
        </div>
      )}
      <div className="table-scroll">
        <table className="people-table">
          <thead><tr><th>Employee</th><th>Payout method</th><th>Wallet</th><th>Net amount</th><th>Status</th></tr></thead>
          <tbody>
            {employees.map((e) => (
              <tr key={e.id}>
                <td><span className="person-cell static-person"><span className={`person-avatar avatar-${e.id.slice(0, 8)}`}>{initials(e.name)}</span><span><strong>{e.name}</strong><small>{e.role_title} · {e.location || "—"}</small></span></span></td>
                <td><span className="network-cell"><i>{e.token === "USDC" ? "$" : "₮"}</i><span><strong>{e.token}</strong><small>{e.network}</small></span></span></td>
                <td><span className="mono-value address-cell">{e.endpoint ? `${e.endpoint.slice(0, 6)}…${e.endpoint.slice(-4)}` : "—"}<Copy size={12} /></span></td>
                <td><strong className="amount-value">{formatMoney(e.amount)}</strong></td>
                <td><span className={`status-chip ${e.status === "ready" ? "status-ready" : e.status === "pending" ? "status-pending" : "status-update_required"}`}>{e.status === "ready" ? <CheckCircle2 size={14} /> : e.status === "pending" ? <Clock3 size={14} /> : <AlertCircle size={14} />}{e.status === "ready" ? "Ready" : e.status === "pending" ? "Pending" : "Update required"}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function InviteManager({ pendingInvites, onChanged }: { pendingInvites: Array<{ id: string; email: string; role: string; status: string; created_at: string }>; onChanged: () => void }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("employee");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const send = async () => {
    setNotice(""); setError("");
    try {
      const res = await api.createInvite({ email, role });
      setEmail("");
      setNotice(res.inviteUrl ? `Invitation created (mock email). Link: ${res.inviteUrl}` : `Invitation sent to ${email}.`);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send");
    }
  };

  return (
    <section className="invite-card">
      <header><div><span className="section-icon"><Link2 size={18} /></span><div><h2>Invitations</h2><p>Send an email invitation — the person creates their own account on acceptance.</p></div></div></header>
      <div className="add-item-row">
        <input placeholder="colleague@company.com" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <select value={role} onChange={(e) => setRole(e.target.value)}><option value="employee">Employee</option><option value="admin">Administrator</option></select>
        <button className="button button-primary" type="button" onClick={send}>Send invitation</button>
      </div>
      {notice && <p className="invite-notice ok">{notice}</p>}
      {error && <p className="invite-notice err">{error}</p>}
      {pendingInvites.length > 0 && (
        <div className="invite-list">
          {pendingInvites.map((inv) => (
            <div key={inv.id}><span><strong>{inv.email}</strong><small>{inv.role} · {inv.status} · {new Date(inv.created_at).toLocaleDateString()}</small></span><span className={`status-chip ${inv.status === "pending" ? "status-pending" : "status-ready"}`}>{inv.status}</span></div>
          ))}
        </div>
      )}
    </section>
  );
}
