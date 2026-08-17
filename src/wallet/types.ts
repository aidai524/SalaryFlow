/**
 * Multi-chain wallet abstraction for Stableflow Pay.
 *
 * Primary use cases:
 * 1. Admin: sign payment intents before payroll submission.
 * 2. Employee: prove ownership of a payout wallet address.
 *
 * Extending to a new chain (NEAR / Solana):
 * 1. Implement the chain-specific hooks behind `useWallet(kind)`.
 * 2. Mount the chain SDK provider inside `WalletProvider`.
 * 3. Register address validation + message signing for that kind.
 * 4. Keep UI components chain-agnostic via this shared surface.
 */

export type ChainKind = "evm" | "near" | "solana";

export interface WalletAccount {
  address: string;
  chainKind: ChainKind;
  /** EVM chain id, NEAR network id, Solana cluster, etc. */
  chainId?: string | number;
}

export interface SignMessageParams {
  /** UTF-8 message or pre-encoded bytes, depending on chain adapter. */
  message: string | Uint8Array;
}

export interface SignMessageResult {
  signature: string;
  address: string;
  chainKind: ChainKind;
}

/**
 * Imperative adapter surface used by non-React code paths.
 * React UI should prefer `useWallet(chainKind)`.
 *
 * NOTE: EVM connection UX is currently RainbowKit-driven (`connect` opens the
 * connect modal). NEAR / Solana adapters should follow the same contract.
 */
export interface WalletAdapter {
  readonly kind: ChainKind;
  connect(): Promise<void> | void;
  disconnect(): Promise<void> | void;
  getAccount(): WalletAccount | null;
  signMessage(params: SignMessageParams): Promise<SignMessageResult>;
  isAddressValid(address: string): boolean;
}

export interface UseWalletResult {
  kind: ChainKind;
  account: WalletAccount | null;
  isConnected: boolean;
  isConnecting: boolean;
  connect: () => void;
  disconnect: () => void;
  signMessage: (params: SignMessageParams) => Promise<SignMessageResult>;
  isAddressValid: (address: string) => boolean;
}

/**
 * Placeholder adapters for chains that are not wired yet.
 * Calling connect / signMessage throws until the adapter is implemented.
 */
export class UnsupportedChainError extends Error {
  constructor(kind: ChainKind, action: string) {
    super(
      `[wallet] Chain "${kind}" is not implemented yet (action: ${action}). ` +
        `Add an adapter under src/wallet/${kind}/ and register it in WalletProvider.`,
    );
    this.name = "UnsupportedChainError";
  }
}
