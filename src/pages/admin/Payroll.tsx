// Admin: Payroll — run list, creation, items, and the direct-pay entry point

import { useState } from "react";
import { ArrowRight, CheckCircle2, ChevronRight, CircleAlert, Clock3, Plus, Send, X } from "lucide-react";
import { api, type AuthUser, type PayrollRun } from "../../lib/api";
import { useApi, formatMoney } from "../../lib/useData";
import { PayDialog } from "../../components/PayDialog";

export function PayrollPage({ user, onRequireWallet }: { user: AuthUser; onRequireWallet: () => void }) {
  const { data, loading, refresh } = useApi(() => api.listRuns(), []);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [label, setLabel] = useState("");
  const [payDate, setPayDate] = useState("");
  const [showPay, setShowPay] = useState(false);

  const runs = data?.runs ?? [];
  const selected = runs.find((r) => r.id === selectedId) ?? null;

  const create = async () => {
    if (!label) return;
    const { run } = await api.createRun({ label, payDate: payDate || new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10) });
    setLabel("");
    setPayDate("");
    setShowCreate(false);
    setSelectedId(run.id);
    refresh();
  };

  return (
    <div className="secondary-page">
      <section className="secondary-heading">
        <div><span className="eyebrow">Payroll</span><h1>Payroll runs</h1><p>Enter net amounts per employee, review status, then pay directly with your wallet.</p></div>
        <div className="head-actions">
          <button className="button button-secondary" type="button" onClick={() => setShowCreate((v) => !v)}><Plus size={17} />New run</button>
          {selected && <button className="button button-primary" type="button" disabled={selected.itemCount === 0} onClick={() => setShowPay(true)}><Send size={17} />Pay now</button>}
        </div>
      </section>

      {showCreate && (
        <section className="create-run-card">
          <div className="form-grid">
            <label className="full-field">Run label<input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. September 2026" autoFocus /></label>
            <label>Pay date<input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} /></label>
            <div className="create-actions"><button className="button button-primary" type="button" onClick={create} disabled={!label}>Create run</button><button className="button button-secondary" type="button" onClick={() => setShowCreate(false)}>Cancel</button></div>
          </div>
        </section>
      )}

      {loading && <p className="page-empty">Loading…</p>}

      {!loading && runs.length === 0 && (
        <section className="empty-state"><h2>No payroll runs yet</h2><p>Create your first run, then add employee payments from the Team payouts directory.</p></section>
      )}

      {runs.length > 0 && (
        <div className="run-grid">
          {runs.map((run: PayrollRun) => (
            <article key={run.id} className={`run-card${selectedId === run.id ? " is-selected" : ""}`} onClick={() => setSelectedId(run.id)}>
              <header>
                <div><h2>{run.label}</h2><p>{run.pay_date} · {run.itemCount} payments</p></div>
                <span className={`large-state state-${run.status === "paid" ? "paid" : "ready"}`}>{run.status === "paid" ? "Paid" : run.status === "draft" ? "Draft" : run.status}</span>
              </header>
              <div className="run-amounts"><div><span>USDC</span><strong>{formatMoney(run.usdc)}</strong></div><div><span>USDT</span><strong>{formatMoney(run.usdt)}</strong></div></div>
            </article>
          ))}
        </div>
      )}

      {selected && <RunDetail runId={selected.id} onChanged={refresh} />}

      {showPay && selected && (
        <PayDialog user={user} run={selected} onClose={() => setShowPay(false)} onPaid={refresh} onRequireWallet={onRequireWallet} />
      )}
    </div>
  );
}

function RunDetail({ runId, onChanged }: { runId: string; onChanged: () => void }) {
  const { data } = useApi(() => api.getRun(runId), [runId]);
  const [showAdd, setShowAdd] = useState(false);
  const [employeeName, setEmployeeName] = useState("");
  const [amount, setAmount] = useState("");
  const [token, setToken] = useState("USDC");
  const [network, setNetwork] = useState("Base");

  if (!data) return null;
  const { run, items } = data;

  const addItem = async () => {
    const amt = Number(amount);
    if (!employeeName || !Number.isFinite(amt) || amt <= 0) return;
    await api.addItem(runId, { employeeName, amount: amt, token, network });
    setEmployeeName(""); setAmount("");
    setShowAdd(false);
    onChanged();
  };

  return (
    <section className="data-card run-detail">
      <header className="card-header">
        <div><h2>{run.label} — payment list</h2><p>Net amounts are locked as entered. {items.length} of {run.itemCount} payments shown.</p></div>
        <button className="button button-secondary" type="button" onClick={() => setShowAdd((v) => !v)}><Plus size={15} />Add payment</button>
      </header>

      {showAdd && (
        <div className="add-item-row">
          <input placeholder="Employee name" value={employeeName} onChange={(e) => setEmployeeName(e.target.value)} />
          <input type="number" placeholder="Net amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <select value={token} onChange={(e) => setToken(e.target.value)}><option>USDC</option><option>USDT</option></select>
          <select value={network} onChange={(e) => setNetwork(e.target.value)}><option>Base</option><option>Arbitrum</option><option>Polygon</option><option>Optimism</option><option>Ethereum</option></select>
          <button className="button button-primary" type="button" onClick={addItem}>Add</button>
        </div>
      )}

      <div className="table-scroll">
        <table className="payroll-table">
          <thead><tr><th>Employee</th><th>Net amount</th><th>Token & network</th><th>Status</th><th /></tr></thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td><span className="person-cell static-person"><span className="person-avatar">{item.employee_name.slice(0, 2).toUpperCase()}</span><span><strong>{item.employee_name}</strong></span></span></td>
                <td><strong className="amount-value">{formatMoney(item.amount)} <small>{item.token}</small></strong></td>
                <td><span className="network-cell"><i>{item.token === "USDC" ? "$" : "₮"}</i><span><strong>{item.token}</strong><small>{item.network}</small></span></span></td>
                <td><span className={`status-chip ${item.status === "paid" ? "status-paid" : item.status === "failed" ? "status-update_required" : "status-pending"}`}>{item.status === "paid" ? <CheckCircle2 size={14} /> : item.status === "failed" ? <CircleAlert size={14} /> : <Clock3 size={14} />}{item.status}</span></td>
                <td>{item.intent_hash ? <span className="mono-value tx-hash">{item.intent_hash.slice(0, 14)}…</span> : <ChevronRight size={16} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
