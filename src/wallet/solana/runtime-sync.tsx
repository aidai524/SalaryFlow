import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useEffect } from "react";
import { setSolanaRuntime } from "../runtime";

/** Keeps the Solana adapter signer available to non-React transfer helpers. */
export function SolanaRuntimeSync() {
  const { connection } = useConnection();
  const { publicKey, signTransaction } = useWallet();

  useEffect(() => {
    if (!publicKey || !signTransaction) {
      setSolanaRuntime(null);
      return;
    }
    setSolanaRuntime({
      publicKey,
      connection,
      signTransaction,
    });
    return () => setSolanaRuntime(null);
  }, [connection, publicKey, signTransaction]);

  return null;
}
