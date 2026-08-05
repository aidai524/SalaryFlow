// EVM wallet connection + binding to the account (payment authorization layer)

import { useAccount, useConnect, useDisconnect } from "wagmi";
import { X } from "lucide-react";
import { api, type AuthUser } from "../lib/api";
import { isValidEthereumAddress } from "../lib/erc191";

export function WalletConnectDialog({ user, onClose, onBound }: { user: AuthUser; onClose: () => void; onBound: (address: string) => void }) {
  const { connect, connectors } = useConnect();
  const { address } = useAccount();
  const { disconnect } = useDisconnect();

  const boundAddress = user.wallet_address;

  const bind = async () => {
    if (!address || !isValidEthereumAddress(address)) return;
    await api.bindWallet(address);
    onBound(address);
  };

  return (
    <div className="dialog-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section className="dialog dialog-small" role="dialog" aria-modal="true" aria-labelledby="wallet-title">
        <header className="dialog-header"><strong>EVM wallet</strong><button className="icon-button" type="button" onClick={onClose} aria-label="Close"><X size={19} /></button></header>
        <div className="dialog-body">
          <h2 id="wallet-title">Payment authorization wallet</h2>
          <p>Connect the wallet that authorizes payroll payments. Your wallet is used to sign payment intents — it is not your login.</p>

          {boundAddress ? (
            <div className="wallet-bound">
              <span className="status-chip status-ready">✓ Bound</span>
              <div>
                <strong className="mono-value">{boundAddress.slice(0, 8)}…{boundAddress.slice(-6)}</strong>
                <small>This wallet signs payments for this account</small>
              </div>
              <div className="wallet-actions">
                <button className="button button-secondary" type="button" onClick={() => disconnect()}>Disconnect</button>
                <button className="button button-primary" type="button" onClick={onClose}>Done</button>
              </div>
            </div>
          ) : (
            <div className="wallet-connect-list">
              {connectors.map((connector) => (
                <button key={connector.uid} type="button" className="wallet-option" onClick={() => connect({ connector })}>
                  <span className="wallet-option-mark">W</span>
                  <span><strong>{connector.name}</strong><small>Browser wallet (MetaMask, Rabby, …)</small></span>
                </button>
              ))}
              {address && !boundAddress && (
                <button className="button button-primary wallet-bind" type="button" onClick={bind}>Bind {address.slice(0, 8)}…</button>
              )}
              {address && (
                <p className="wallet-hint">Connected as <span className="mono-value">{address}</span>. Click “Bind” to attach it to your account.</p>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
