import { Buffer } from "buffer";
import { useCallback, useEffect, useMemo, useState } from "react";
import { isAddressValid } from "@/lib/address-validation";
import type { SignMessageParams, SignMessageResult, UseWalletResult, WalletAccount } from "../types";
import { NEAR_SIGN_RECIPIENT, useNearWalletContext } from "./provider";

function toUtf8(message: string | Uint8Array): string {
  if (typeof message === "string") return message;
  return new TextDecoder().decode(message);
}

function toNonceBytes(nonce: Uint8Array | string | undefined): Buffer {
  if (!nonce) {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    return Buffer.from(bytes);
  }
  if (typeof nonce === "string") {
    try {
      const binary = atob(nonce);
      const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
      if (bytes.length === 32) return Buffer.from(bytes);
    } catch {
      // fall through
    }
    throw new Error("[wallet:near] NEP-413 nonce must be 32 bytes");
  }
  if (nonce.length !== 32) throw new Error("[wallet:near] NEP-413 nonce must be 32 bytes");
  return Buffer.from(nonce);
}

export function useNearWallet(): UseWalletResult {
  const { selector, modal, accountId, connecting } = useNearWalletContext();
  const [modalOpen, setModalOpen] = useState(false);

  const account = useMemo<WalletAccount | null>(() => {
    if (!accountId) return null;
    return { address: accountId, chainKind: "near", chainId: "mainnet" };
  }, [accountId]);

  useEffect(() => {
    if (!modal) return;
    const sub = modal.on("onHide", (event) => {
      if (event.hideReason === "user-triggered") setModalOpen(false);
    });
    return () => sub.remove();
  }, [modal]);

  useEffect(() => {
    if (accountId) setModalOpen(false);
  }, [accountId]);

  const connect = useCallback(() => {
    const show = () => {
      setModalOpen(true);
      modal?.show();
    };
    if (!accountId || !selector) {
      show();
      return;
    }
    void (async () => {
      try {
        const wallet = await selector.wallet();
        await wallet.signOut();
      } catch {
        // Still open the picker so the user can switch wallets.
      }
      show();
    })();
  }, [accountId, modal, selector]);

  const disconnect = useCallback(() => {
    void (async () => {
      if (!selector) return;
      const wallet = await selector.wallet();
      await wallet.signOut();
    })();
  }, [selector]);

  const signMessage = useCallback(
    async (params: SignMessageParams): Promise<SignMessageResult> => {
      if (!selector || !accountId) {
        throw new Error("[wallet:near] No connected account to sign with.");
      }
      const wallet = await selector.wallet();
      if (typeof wallet.signMessage !== "function") {
        throw new Error("[wallet:near] Connected wallet does not support message signing.");
      }
      const nonce = toNonceBytes(params.nonce);
      const recipient = params.recipient || NEAR_SIGN_RECIPIENT;
      const signed = await wallet.signMessage({
        message: toUtf8(params.message),
        recipient,
        nonce,
      });
      if (!signed?.signature || !signed.publicKey || !signed.accountId) {
        throw new Error("[wallet:near] Wallet did not return a signature.");
      }
      return {
        signature: signed.signature,
        address: signed.accountId,
        chainKind: "near",
        publicKey: signed.publicKey,
        nonce: Buffer.from(nonce).toString("base64"),
        recipient,
      };
    },
    [accountId, selector],
  );

  const isAddressValidFn = useCallback((value: string) => isAddressValid(value, "near"), []);

  return useMemo<UseWalletResult>(() => ({
    kind: "near",
    account,
    isConnected: Boolean(accountId),
    isConnecting: connecting,
    isModalOpen: modalOpen,
    connect,
    disconnect,
    signMessage,
    isAddressValid: isAddressValidFn,
  }), [account, accountId, connect, connecting, disconnect, isAddressValidFn, modalOpen, signMessage]);
}
