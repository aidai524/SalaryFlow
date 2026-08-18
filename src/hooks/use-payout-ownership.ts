import { useEffect, useState } from "react";
import { chainKindForNetwork } from "@/config/chains";
import { isAddressValid, sameAddress } from "@/lib/address-validation";
import { api, ApiError, type MyPayout } from "@/lib/api";
import { useWallet, type ChainKind } from "@/wallet";

type SavedPayout = Pick<
  MyPayout,
  "token" | "network" | "endpoint" | "status" | "payout_verified_at"
>;

export function usePayoutOwnership({
  token,
  network,
  endpoint,
  setEndpoint,
  savedPayout,
  onVerified,
  onDirty,
}: {
  token: string;
  network: string;
  endpoint: string;
  setEndpoint: (value: string) => void;
  savedPayout: SavedPayout | null | undefined;
  onVerified?: (payout: MyPayout) => void | Promise<void>;
  onDirty?: () => void;
}) {
  const chainKind = (chainKindForNetwork(network) || "evm") as ChainKind;
  const wallet = useWallet(chainKind);
  const address = wallet.account?.address;
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const connectedAddressMatches = Boolean(
    address && sameAddress(address, endpoint.trim(), chainKind),
  );
  const payoutConfigurationMatches = Boolean(
    savedPayout
    && savedPayout.token === token
    && savedPayout.network === network
    && sameAddress(savedPayout.endpoint.trim(), endpoint.trim(), chainKind),
  );
  const ownershipVerified = Boolean(
    payoutConfigurationMatches
    && savedPayout?.status === "ready"
    && savedPayout.payout_verified_at,
  );

  useEffect(() => {
    if (ownershipVerified) return;
    setNotice((prev) => {
      if (!prev) return prev;
      const staleSuccess = /ownership verified|payout method is ready|already verified/i.test(prev);
      return staleSuccess ? "" : prev;
    });
  }, [token, network, endpoint, ownershipVerified]);

  const connectWallet = () => {
    setError("");
    setNotice("");
    onDirty?.();
    wallet.connect();
  };

  const changeConnectedWallet = () => {
    setError("");
    setNotice("");
    onDirty?.();
    wallet.connect();
  };

  const useConnectedAddress = () => {
    if (!address) return;
    setEndpoint(address);
    onDirty?.();
    setError("");
    const alreadyVerified = Boolean(
      savedPayout?.status === "ready"
      && savedPayout.payout_verified_at
      && savedPayout.token === token
      && savedPayout.network === network
      && sameAddress(savedPayout.endpoint.trim(), address, chainKind),
    );
    setNotice(alreadyVerified
      ? "This connected wallet is already verified."
      : "Connected wallet selected. Verify ownership to save and activate it.");
  };

  const verifyWallet = async () => {
    if (ownershipVerified) return;
    setError("");
    setNotice("");
    if (!isAddressValid(endpoint.trim(), chainKind)) {
      setError("Enter a valid payout address for the selected network first.");
      return;
    }
    if (!address || !connectedAddressMatches) {
      setError("Connect the same wallet address entered above before verifying.");
      return;
    }

    setVerifying(true);
    try {
      const challenge = await api.createPayoutChallenge({
        token,
        network,
        endpoint: endpoint.trim(),
      });
      const signed = await wallet.signMessage({
        message: challenge.message,
        nonce: challenge.nonce || undefined,
        recipient: challenge.recipient || undefined,
      });
      const result = await api.verifyPayout({
        challengeId: challenge.challengeId,
        signature: signed.signature,
        publicKey: signed.publicKey,
        accountId: signed.address,
      });
      setEndpoint(result.payout.endpoint);
      await onVerified?.(result.payout);
      setNotice("Wallet ownership verified. This payout method is ready.");
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : cause instanceof Error
            ? cause.message
            : "Wallet verification failed",
      );
    } finally {
      setVerifying(false);
    }
  };

  return {
    address,
    isConnected: wallet.isConnected,
    verifying,
    error,
    notice,
    setError,
    setNotice,
    connectedAddressMatches,
    ownershipVerified,
    verifiedEndpoint: savedPayout?.endpoint,
    connectWallet,
    changeConnectedWallet,
    useConnectedAddress,
    verifyWallet,
  };
}
