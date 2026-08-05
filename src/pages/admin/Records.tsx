// Admin: Payment records — chain records with intent hashes and status

import { AlertCircle, CheckCircle2, Clock3, Copy } from "lucide-react";
import { api } from "../../lib/api";
import { useApi, formatMoney } from "../../lib/useData";

export function RecordsPage() {
  const { data, loading } = useApi(() => api.listRecords(), []);
  const records = data?.records ?? [];
  const confirmed = records.filter((r) => r.status === "confirmed").length;

  return (
    <div className="secondary-page">
      <section className="secondary-heading">
        <div><span className="eyebrow">Payment records</span><h1>Every payment has a clear outcome</h1><p>Swap details stay on NEAR Intents' private chain; intent hashes and statuses are recorded here.</p></div>
      </section>

      <section className="people-summary onchain-summary">
        <div><strong>{records.length}</strong><span>Records</span></div>
        <div><strong>{confirmed}</strong><span>Confirmed</span></div>
        <div><strong>{records.filter((r) => r.status === "pending").length}</strong><span>Pending</span></div>
        <div className="summary-protection"><AlertCircle size={19} /><span><strong>Private by design</strong><small>Swap amounts hidden from public chains; visible to authorized parties</small></span></div>
      </section>

      {loading && <p className="page-empty">Loading…</p>}
      {!loading && records.length === 0 && (
        <section className="empty-state"><h2>No payments yet</h2><p>Pay a payroll run to generate confidential payment records.</p></section>
      )}

      {records.length > 0 && (
        <section className="data-card onchain-card">
          <header className="card-header"><div><h2>Chain records</h2><p>Intent hashes link each payment to NEAR Intents settlement.</p></div><span className="quiet-meta">confidentiality: advanced</span></header>
          <div className="table-scroll">
            <table className="onchain-table">
              <thead><tr><th>Employee</th><th>Net amount</th><th>Token & network</th><th>Intent hash</th><th>Status</th><th>Submitted</th></tr></thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id}>
                    <td><span className="person-cell static-person"><span className="person-avatar">{r.employee_name.slice(0, 2).toUpperCase()}</span><span><strong>{r.employee_name}</strong></span></span></td>
                    <td><strong className="amount-value">{formatMoney(r.amount)} <small>{r.token}</small></strong></td>
                    <td><span className="network-cell"><i>{r.token === "USDC" ? "$" : "₮"}</i><span><strong>{r.token}</strong><small>{r.network}</small></span></span></td>
                    <td><span className="mono-value tx-hash">{r.intent_hash ? `${r.intent_hash.slice(0, 18)}…` : "—"}<Copy size={12} /></span></td>
                    <td><span className={`status-chip ${r.status === "confirmed" ? "status-paid" : r.status === "failed" ? "status-update_required" : "status-pending"}`}>{r.status === "confirmed" ? <CheckCircle2 size={14} /> : r.status === "failed" ? <AlertCircle size={14} /> : <Clock3 size={14} />}{r.status}</span></td>
                    <td>{r.submitted_at ? new Date(r.submitted_at).toLocaleString() : r.quote_at ? new Date(r.quote_at).toLocaleString() : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <div className="prototype-inline-note"><AlertCircle size={15} /><span>Confidential swaps settle on the FAR private chain. Deposit and withdrawal transactions on external chains remain public, as required.</span></div>
    </div>
  );
}
