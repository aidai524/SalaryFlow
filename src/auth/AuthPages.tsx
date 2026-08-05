// Authentication pages: login / register / accept invitation

import { useEffect, useState } from "react";
import { api, ApiError, type AuthUser } from "../lib/api";

function Field({ label, type = "text", value, onChange, placeholder, autoFocus }: {
  label: string; type?: string; value: string; onChange: (v: string) => void; placeholder?: string; autoFocus?: boolean;
}) {
  return (
    <label className="auth-field">
      <span>{label}</span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} autoFocus={autoFocus} autoComplete={type === "password" ? "current-password" : "on"} />
    </label>
  );
}

export function LoginPage({ onAuthed, onGoInvite }: { onAuthed: (u: AuthUser) => void; onGoInvite: () => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "login") {
        const { user } = await api.login({ email, password });
        onAuthed(user);
      } else {
        const { user } = await api.register({ email, password, name, orgName });
        onAuthed(user);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="auth-brand-mark">SF</span>
          <div><strong>SalaryFlow</strong><small>Stablecoin payroll for global teams</small></div>
        </div>
        <h1>{mode === "login" ? "Sign in" : "Create your account"}</h1>
        <p className="auth-sub">
          {mode === "login" ? "Welcome back. Sign in to your workspace." : "Create an organization and invite your team."}
        </p>

        <form onSubmit={submit}>
          {mode === "register" && (
            <>
              <Field label="Your name" value={name} onChange={setName} placeholder="Lina Qiao" autoFocus />
              <Field label="Organization name" value={orgName} onChange={setOrgName} placeholder="Northstar Labs" />
            </>
          )}
          <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="you@company.com" autoFocus={mode === "login"} />
          <Field label="Password" type="password" value={password} onChange={setPassword} placeholder="At least 8 characters" />
          {error && <div className="auth-error" role="alert">{error}</div>}
          <button className="button button-primary auth-submit" type="submit" disabled={busy}>
            {busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>

        <div className="auth-switch">
          {mode === "login" ? (
            <button type="button" onClick={() => { setMode("register"); setError(""); }}>New here? <strong>Create an account</strong></button>
          ) : (
            <button type="button" onClick={() => { setMode("login"); setError(""); }}>Already have an account? <strong>Sign in</strong></button>
          )}
          <button type="button" onClick={onGoInvite} className="auth-invite-link">Have an invitation link? <strong>Accept invitation</strong></button>
        </div>
      </div>
    </div>
  );
}

export function InvitePage({ onAuthed, onGoLogin }: { onAuthed: (u: AuthUser) => void; onGoLogin: () => void }) {
  const [token, setToken] = useState("");
  const [invite, setInvite] = useState<{ email: string; role: string; orgName: string } | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [resolving, setResolving] = useState(true);

  useEffect(() => {
    const pathToken = window.location.pathname.match(/^\/invite\/([0-9a-f]+)/)?.[1];
    if (!pathToken) {
      setResolving(false);
      return;
    }
    setToken(pathToken);
    api.resolveInvite(pathToken)
      .then((r) => { setInvite(r.invitation); setEmail(r.invitation.email); })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Invalid invitation"))
      .finally(() => setResolving(false));
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const { user } = await api.acceptInvite({ token, email, name, password });
      onAuthed(user);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="auth-brand-mark">SF</span>
          <div><strong>SalaryFlow</strong><small>Stablecoin payroll for global teams</small></div>
        </div>
        {resolving ? (
          <p className="auth-sub">Loading invitation…</p>
        ) : invite ? (
          <>
            <h1>You're invited</h1>
            <p className="auth-sub">
              <strong>{invite.orgName}</strong> invited <strong>{invite.email}</strong> to join as {invite.role === "admin" ? "an administrator" : "a team member"}.
            </p>
            <form onSubmit={submit}>
              <Field label="Your name" value={name} onChange={setName} placeholder="Your full name" autoFocus />
              <Field label="Email" type="email" value={email} onChange={setEmail} />
              <Field label="Set a password" type="password" value={password} onChange={setPassword} placeholder="At least 8 characters" />
              {error && <div className="auth-error" role="alert">{error}</div>}
              <button className="button button-primary auth-submit" type="submit" disabled={busy || !invite}>
                {busy ? "Please wait…" : "Accept invitation"}
              </button>
            </form>
          </>
        ) : (
          <>
            <h1>Accept an invitation</h1>
            <p className="auth-sub">Paste the invitation link from your email.</p>
            <input className="auth-token-input" placeholder="https://salaryflow.dev/invite/…" value={token} onChange={(e) => setToken(e.target.value)} />
            <button className="button button-primary auth-submit" type="button" onClick={() => {
              setResolving(true); setError("");
              api.resolveInvite(token).then((r) => { setInvite(r.invitation); setEmail(r.invitation.email); }).catch((err) => setError(err instanceof ApiError ? err.message : "Invalid invitation")).finally(() => setResolving(false));
            }}>Continue</button>
            {error && <div className="auth-error" role="alert">{error}</div>}
          </>
        )}
        <div className="auth-switch">
          <button type="button" onClick={onGoLogin}>Already have an account? <strong>Sign in</strong></button>
        </div>
      </div>
    </div>
  );
}
