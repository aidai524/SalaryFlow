import type { WalletSelector } from "@near-wallet-selector/core";
import type { Connection, PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";

export interface SolanaRuntime {
  publicKey: PublicKey;
  connection: Connection;
  signTransaction: <T extends Transaction | VersionedTransaction>(tx: T) => Promise<T>;
}

let nearSelector: WalletSelector | null = null;
let solanaRuntime: SolanaRuntime | null = null;

export function setNearSelector(selector: WalletSelector | null) {
  nearSelector = selector;
}

export function getNearSelector(): WalletSelector | null {
  return nearSelector;
}

export function setSolanaRuntime(runtime: SolanaRuntime | null) {
  solanaRuntime = runtime;
}

export function getSolanaRuntime(): SolanaRuntime | null {
  return solanaRuntime;
}
