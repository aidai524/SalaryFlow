// Admin: Settings — organization, payment wallet, security basics

import { useEffect, useState } from "react";
import { AlertCircle, EyeOff, KeyRound, WalletCards, Settings2 } from "lucide-react";
import { api, type AuthUser } from "../../lib/api";
import { useApi } from "../../lib/useData";
import { WalletConnectDialog } from "../../components/WalletConnect";

export function SettingsPage({ user, onUserChange, onOrgChange }: { user: AuthUser; onUserChange: (u: AuthUser) => void; onOrgChange: (name: string, memberCount: number) => void }) {
  const { data: org, refresh: refreshOrg } = useApi(() => api.org(), []);
  const [showWallet, setShowWallet] = useState(false);
  const [name, setName] = useState(user.name);
  const [orgName, setOrgName] = useState("");
  const [country, setCountry] = useState("");
  const [savedOrg, setSavedOrg] = useState(false);

  useEffect(() => {
    if (org?.org) {
      setOrgName(org.org.name);
      setCountry(org.org.country || "");
    }
  }, [org?.org?.id]);

  const saveName = async () => {
    if (!name.trim() || name === user.name) return;
    await api.updateMe({ name: name.trim() });
    onUserChange({ ...user, name: name.trim() });
  };

  const saveOrg = async () => {
    await api.updateOrg({ name: orgName.trim() || undefined, country: country.trim() || undefined });
    setSavedOrg(true);
    setTimeout(() => setSavedOrg(false), 3000);
    refreshOrg();
    if (orgName.trim()) onOrgChange(orgName.trim(), org?.members.length ?? 0);
  };

  return (
    <div className="secondary-page">
      <section className="secondary-heading"><div><span className="eyebrow">Settings</span><h1>Payroll preferences</h1><p>Organization, payment wallet, and security.</p></div><span className="settings-local"><Settings2 size={15} />Live API</span></section>

      <section className="settings-layout">
        <div className="settings-nav" aria-label="Settings categories"><span className="is-active"><WalletCards size={16} />Organization & wallet</span><span><EyeOff size={16} />Data protection</span><span><KeyRound size={16} />Security</span></div>
        <div className="settings-panels">
          <section className="settings-card">
            <header><div><h2>Organization</h2><p>Shown in the workspace switcher and invitation emails.</p></div></header>
            <div className="settings-field"><label htmlFor="org-name">Organization name<span>Visible to all members</span></label><div className="inline-edit"><input id="org-name" value={orgName} onChange={(e) => setOrgName(e.target.value)} /></div></div>
            <div className="settings-field"><label htmlFor="org-country">Country<span>Optional headquarters location</span></label><div className="inline-edit"><input id="org-country" value={country} onChange={(e) => setCountry(e.target.value)} placeholder="e.g. Singapore" /></div></div>
            <div className="settings-actions"><button className="button button-primary" type="button" onClick={saveOrg} disabled={!orgName.trim()}>{savedOrg ? "Saved ✓" : "Save organization"}</button></div>
          </section>

          <section className="settings-card">
            <header><div><h2>Profile</h2><p>Your name as shown to your team.</p></div></header>
            <div className="settings-field"><label htmlFor="profile-name">Your name<span>Shown to your team</span></label><div className="inline-edit"><input id="profile-name" value={name} onChange={(e) => setName(e.target.value)} /><button className="button button-secondary" type="button" onClick={saveName}>Save</button></div></div>
          </section>

          <section className="settings-card">
            <header><div><h2>Payment wallet</h2><p>Used to sign payroll payment intents (NEAR Intents confidential swaps).</p></div></header>
            <div className="connection-row">
              <span className="setting-symbol"><WalletCards size={17} /></span>
              <span><strong>EVM wallet</strong><small>{user.wallet_address ? `${user.wallet_address.slice(0, 8)}…${user.wallet_address.slice(-6)}` : "Not connected"}</small></span>
              <span className="connection-state" style={user.wallet_address ? { color: "var(--green)", background: "var(--green-soft)" } : undefined}>{user.wallet_address ? "Bound" : "Not connected"}</span>
            </div>
            <div className="settings-actions"><button className="button button-primary" type="button" onClick={() => setShowWallet(true)}><WalletCards size={16} />{user.wallet_address ? "Change wallet" : "Connect wallet"}</button></div>
          </section>

          <section className="settings-card">
            <header><div><h2>Security</h2><p>Authentication is email + password. Passwords are stored as PBKDF2 hashes.</p></div></header>
            <div className="settings-field"><label htmlFor="pass-hint">Password policy<span>Min 8 characters · PBKDF2 150k iterations</span></label><span className="connection-state" style={{ color: "var(--green)", background: "var(--green-soft)" }}>Configured</span></div>
          </section>
        </div>
      </section>

      <div className="prototype-inline-note"><AlertCircle size={15} /><span>Production adds TOTP 2FA, session rotation, and audit-grade logging. Wallet connection never exposes private keys to SalaryFlow.</span></div>

      {showWallet && <WalletConnectDialog user={user} onClose={() => setShowWallet(false)} onBound={(address) => { setShowWallet(false); onUserChange({ ...user, wallet_address: address, wallet_verified: true }); }} />}
    </div>
  );
}
