import { useState } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { useOpenWalletModal } from "@/hooks/use-open-wallet-modal";
import { api, ApiError, type Employee } from "@/lib/api";
import { isValidEthereumAddress } from "@/lib/erc191";

type SavedPayout = Pick<
  Employee,
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
  onVerified?: (payout: Employee) => void | Promise<void>;
  onDirty?: () => void;
}) {
  const { openWalletModal, isConnected } = useOpenWalletModal();
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const connectedAddressMatches = Boolean(
    address && address.toLowerCase() === endpoint.trim().toLowerCase(),
  );
  const payoutConfigurationMatches = Boolean(
    savedPayout
    && savedPayout.token === token
    && savedPayout.network === network
    && savedPayout.endpoint.trim().toLowerCase() === endpoint.trim().toLowerCase(),
  );
  const ownershipVerified = Boolean(
    payoutConfigurationMatches
    && savedPayout?.status === "ready"
    && savedPayout.payout_verified_at,
  );

  const connectWallet = () => {
    setError("");
    setNotice("");
    onDirty?.();
    openWalletModal();
  };

  const changeConnectedWallet = () => {
    setError("");
    setNotice("");
    onDirty?.();
    openWalletModal();
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
      && savedPayout.endpoint.trim().toLowerCase() === address.toLowerCase(),
    );
    setNotice(alreadyVerified
      ? "This connected wallet is already verified."
      : "Connected wallet selected. Verify ownership to save and activate it.");
  };

  const verifyWallet = async () => {
    if (ownershipVerified) return;
    setError("");
    setNotice("");
    if (!isValidEthereumAddress(endpoint.trim())) {
      setError("Enter a valid EVM payout address first.");
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
      const signature = await signMessageAsync({ message: challenge.message });
      const result = await api.verifyPayout({
        challengeId: challenge.challengeId,
        signature,
      });
      setEndpoint(result.payout.endpoint);
      setNotice("Wallet ownership verified. This payout method is ready.");
      await onVerified?.(result.payout);
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
    isConnected,
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
